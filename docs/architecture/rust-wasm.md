# Rust/WASM e execução pesada no navegador

O primeiro kernel próprio em Rust calcula visibilidade e nível de detalhe da
torcida. `CrowdLod.tsx` continua responsável pelas instâncias Three.js e pelos
uploads para a GPU. O kernel recebe buffers numéricos, faz culling dos setores,
ordenação por distância e seleção limitada de espectadores. Retorna índices e
tiers compactados em `Uint32Array`.

## Fronteira de execução

- `wasm/crowd-visibility/src/lib.rs`: cálculo puro, sem DOM, rede ou saves.
- `src/game/wasm/crowd-visibility.ts`: buffers, loader assíncrono, conversão da
  resposta e implementação TypeScript equivalente.
- `src/game/wasm/pkg`: JS, declarações e binário gerados e entregues com o código.
- `src/components/game/stadium/CrowdLod.tsx`: integração na cena real, preservando
  frequência de atualização, teto de instâncias e escolha de malhas.

O import é dinâmico e ocorre ao montar a torcida. SSR, ausência de WebAssembly,
falha de download/compilação ou exceção na seleção usam o cálculo TypeScript.
A falha do loader é memorizada para evitar tentativas repetidas. O bundle de
entrada não precisa carregar o kernel nem a biblioteca 3D.

O Rust não recebe regras da partida, RNG, placar, JSON de carreira ou semanas da
temporada. A simulação continua sequencial no Worker dedicado. A física da bola
usa Rapier/WASM no Worker; o contrato existente de integração física de alta
fidelidade é 139 Hz, enquanto regras determinísticas têm relógio próprio de
30 Hz. Frequência de física não determina FPS de renderização.

## Compilação e integridade

Use Node 24 e npm 11. Para modificar o Rust, instale Rust 1.99.0, o target
`wasm32-unknown-unknown` e `wasm-pack` 0.15.0. Em seguida:

```sh
npm ci
npm run wasm:test
npm run wasm:build
npm exec -- vitest run src/game/wasm --pool=forks --maxWorkers=1
```

`scripts/build-wasm.mjs` compila com `Cargo.lock`, usa cache temporário local e
remove somente o `.gitignore` automático do pacote gerado. Os artefatos são
versionados para que o build habitual do frontend e o Lovable não dependam de
uma instalação Rust. Entregue fonte, `Cargo.lock` e arquivos gerados juntos.
O wasm-opt pré-compilado usado pelo wasm-pack varia por sistema operacional,
então os bytes do WASM podem diferir entre Windows e Linux. O job Rust no CI
fixa as ferramentas, compara as bindings geradas e testa a paridade tanto do
WASM recém-compilado quanto do binário versionado.

Os testes executam o binário real, comparando índices, contagens e tiers em
câmeras ampla/próxima, perspectiva/ortográfica, câmera voltada para fora,
empates de distância, limites de LOD e vários orçamentos. A distância usa a
mesma ordem `sqrt((x*x + y*y) + z*z)` nos dois caminhos; trocar por `hypot` muda
arredondamentos e pode alterar desempates. Não enfraqueça a comparação exata.

## Medição e próximos kernels

```sh
node scripts/crowd-wasm-benchmark.mjs
```

O microbenchmark inclui cópias e decodificação na ponte JS/WASM. Não mede GPU,
frames ou toda a partida. O kernel é pequeno: uma medição teve ganho em alguns
orçamentos e pior p95 em outro. Isso não sustenta uma promessa de ganho geral
de FPS. O relatório fica em `verification/stack-wasm-2026-10-03`.

Para investigar gargalos de transporte, `createLiveMatchController` aceita
`telemetry: { onSample }`. As amostras opt-in incluem origem Worker/fallback,
sequência, intervalo entre snapshots, estimativa de bytes e tempo de
`WorkerMatchView.apply`. Use um buffer ou ref, sem `setState` em cada entrega.
Os bytes são estimados estruturalmente; não são uma medida exata do protocolo
de clone do navegador. O payload e as regras da partida permanecem iguais.

Antes de migrar anatomia, cloth ou regras para outro kernel, meça o custo real,
crie fixtures e rode os dois caminhos em comparação. Regras autoritativas
precisam preservar RNG, ordem de atualização, replay e compatibilidade de saves.
