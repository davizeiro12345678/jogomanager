# Índice da evidência de qualidade

A fonte medida é `0a6a04e581571a367cc1c742ead21f984abbbc1b`, base `c20036f33a8f7d8eff15012d276606a3964e4a54`, no [draft PR #128](https://github.com/davizeiro12345678/jogomanager/pull/128). Os oito workflows dessa fonte passaram. A correção CSS mobile e os ajustes posteriores de captura estão identificados no relatório e terão a CI do próximo commit; os arquivos medidos do renderizador mantêm seus hashes.

- [Relatório em português](report.md): resultados, quatro versões de render, todos os 16 casos do CodSpeed e de cada um dos três protocolos locais, medianas do construtor, Lighthouse, SQL, UI e limites.
- [Manifesto detalhado](artifact-manifest.md): arquivos por fase e escopo, incluindo tentativas reprovadas preservadas.
- [Privacidade e tamanhos](privacy-review.md): varredura final, fixtures identificadas e vídeos excluídos do Git.
- [Figuras atuais e hashes das entradas](figures/ownership-stage/README.md): oito figuras em PNG e SVG. As séries históricas permanecem em `figures/intermediate/` e `figures/ibl-stage/`.

## Medições principais

| Área | Entrada |
| --- | --- |
| FPS físico sem gravação | [Comparação atual](graphics/comparison-final-ownership.json), [fonte/build medidos](graphics/final-ownership-source.json) |
| CodSpeed remoto | [16 valores públicos](ci-source-0a6-codspeed-public-table.json), [comentário preciso do bot](ci-source-0a6-codspeed-comparison.json), [limitações de syscalls](ci-source-0a6-codspeed-warnings.json) |
| CPU local | [Curto](cpu/comparison.json), [estendido](cpu-extended/comparison.json), [afinidade](cpu-affinity/comparison.json) |
| Gate do construtor | [Medianas oficiais da CI](ci-source-0a6-constructor-abba.json), [controle local](constructor-affinity/match-setup.json) |
| CI geral | [371 arquivos e 2.203 testes](ci-source-0a6-full-vitest-summary.json), [oito workflows concluídos](ci-source-0a6-final.json) |
| Lighthouse mobile | [15 medições e agregados pessimistas](ci-source-0a6-mobile-lighthouse-metrics.json) |
| UI corrigida | [Metadados da captura final mobile](interface/final-mobile/interface.json), [oito testes de layout](mobile-layout-regression-tests.json); PNGs das rotas de contato/criador removidos do branch por privacidade |
| Worker real local | [200 rejeições antes da autenticação](worker-boundaries-final.json) |
| Vídeos completos | [Metadata, hashes e validação](graphics/video/video-manifest.json) |

## Vídeos locais, fora do Git

Os arquivos abaixo são entregas locais. A cadência de 25 FPS do vídeo VP8 não representa o FPS do jogo. As duas gravações incluem overhead de captura e ficam fora da comparação física sem vídeo.

| Captura | Caminho relativo local | Tamanho | Duração |
| --- | --- | ---: | ---: |
| Broadcast base | `graphics/video/page@e574c5358b02cc5c15ae4d04fde8b8f7.webm` | 58.919.009 bytes | 364,52 s |
| Broadcast ownership | `graphics/video/page@57507cd63a8e9bfc6ab136f9d9b010bc.webm` | 57.773.125 bytes | 364,24 s |

Os vídeos menores de cinema e interface também permanecem locais; seus ponteiros estão em `cinematic/baseline-video.json`, `cinematic/final-video.json` e `interface/final-mobile/interface.json`. A tentativa falha de captura de cinema foi preservada separadamente e não é apresentada como sucesso.

O relatório registra a média física de 82,263 FPS e o pico de 226 draw calls, junto com o pior stall de 800,8 ms, as duas regressões CodSpeed, a meta universal de +89% não atingida e a campanha física ainda incompleta. Nenhum merge ou deploy de produção foi realizado.
