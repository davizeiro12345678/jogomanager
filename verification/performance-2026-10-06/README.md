# Baseline de performance — 2026-10-06

Baseline capturado no checkout isolado `audit-jogomanager-646afae`, com o
fixture determinístico `Flamengo x Palmeiras`, seed `graphics-high-v1`,
1280×720 e DPR 1.

## Resultado reproduzível

- Instalação, `tsc` e `graphics:build`: passaram.
- Suite anterior à nova telemetria: 121 arquivos / 711 testes passaram.
- Snapshot atual por clone de objetos: média 15.525 bytes, p95 15.693 bytes,
  máximo 15.721 bytes.
- `WorkerMatchView.apply`: média 0,046 ms, p95 0,095 ms, máximo 0,224 ms no
  processo Vitest/Node.
- Benchmark 3D de 65,0 s: média 35,35 FPS, p95 de frame 46,90 ms, p99
  85,20 ms, máximo 298,60 ms, 90 stalls acima de 50 ms.
- Draw calls: média 196,80, máximo 322; triângulos médios 140.242;
  408 geometrias, 77 texturas, 116 programas e 151 materiais.
- Heap no último sample: 244.408.688 bytes (~233,0 MiB), via
  `performance.memory.usedJSHeapSize`.

O `baseline.json` contém todos os números e o backend detectado. A execução
mostrou o texto de fallback de WebGL no navegador embutido; por isso os FPS
servem como amostra local comparável, não como certificação de uma matriz de
GPUs físicas. O valor do heap é um ponto final, não uma série de crescimento.

## Artefatos e limites

- `src/game/performance-baseline.test.ts` mede bytes serializados do snapshot
  legado e custo de `apply`.
- `src/game/frame-metrics.ts` e `FrameProbe.tsx` expõem a leitura opcional de
  heap no relatório do benchmark.
- `d390.png` e `d1280.png` não estavam na raiz deste checkout na captura; a
  validação visual de carreira deve registrar essa ausência até que as
  referências sejam disponibilizadas.

## Replay

O codec v3 quantizado, versionado e idempotentemente decodificável foi medido
com 23.284 frames (~90 minutos). A redução foi de 5,6% porque os dados visuais
versionados continuam dominando o armazenamento. O gate de 20% mantém novas
gravações no formato v2 com marcador de versão; v2, v3 e dados sem versão são
lidos pelo mesmo caminho. Isso preserva a compatibilidade sem vender uma
otimização marginal como resultado material.
