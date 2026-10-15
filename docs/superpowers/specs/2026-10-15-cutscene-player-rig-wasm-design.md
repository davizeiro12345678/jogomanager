# Design: Modularização de cutscenes, PlayerRig e geometria WASM

**Status:** proposta para revisão do usuário
**PR de referência:** #39, branch `perf/cinematic-rig-wasm-modules-20261015`, head verificado `38980cb`

## Objetivo

Reduzir o JavaScript transferido e o trabalho de inicialização das páginas de jogo carregando somente as cenas e os rigs necessários, modularizar responsabilidades que ainda estão concentradas em arquivos grandes e avaliar o caminho existente de geometria Rust/WASM com evidência comparável. O comportamento visual, a identidade determinística do jogador, o fallback 2D/3D e a autoridade sequencial da partida permanecem intactos.

## Estado observado

- O PR #39 já separa o fallback ilustrado de cutscene e carrega `PlayerRig` sob demanda quando há jogador próximo selecionado.
- `CinematicStage3D.tsx` ainda importa estaticamente os sete ambientes exportados por `CinematicLocationSets.tsx`; o bundle de uma cena inclui ambientes que não estão ativos.
- `CutsceneStage.tsx`, `CutsceneBackdrop.tsx`, `CinematicLocationSets.tsx` e `PlayerRig.tsx` continuam concentrando responsabilidades de playback/UI, ilustração, ambientes e composição/atualização do rig, respectivamente.
- O Rust `generate_rig_section` e seu wrapper WASM já existem. `rig-geometry.worker.ts` os invoca com limites de entrada/saída, cache limitado e fallback TypeScript. O caminho é consumido pela geometria do jogador, mas `RUST_GEOMETRY_RELEASE` permanece desativado porque não há medições completas de fluxo.
- A execução CodSpeed concluída mais recente é anterior ao head `38980cb`; a comparação disponível entre main e PR usou CPUs diferentes. Ela não é evidência válida de ganho ou regressão deste head.
- O worktree original contém mudanças locais não publicadas e não relacionadas ao PR limpo. Essas alterações não fazem parte desta proposta e serão preservadas.

## Alternativas consideradas

1. **Chunks por ambiente e carregamento sob demanda — recomendado.** Cada cutscene carrega apenas o ambiente selecionado; `Suspense` mantém um estado de carregamento/fallback já existente. Reduz trabalho e bytes de caminhos não usados, com mais fronteiras assíncronas a testar.
2. **Separar arquivos mantendo imports estáticos.** Melhora a leitura e os limites de código, mas não reduz o que a página transfere quando o módulo pai é carregado; insuficiente para o objetivo de performance.
3. **Inicializar WASM eager na página ou mover autoridade de jogo para Rust.** Rejeitado: pode atrasar primeira renderização e não torna dados do cliente confiáveis. O contrato atual preserva o Worker sequencial e o fallback TS.

## Arquitetura proposta

### Cutscenes

- Separar os sete ambientes de `CinematicLocationSets.tsx` em módulos por ambiente dentro de `src/components/game/cinematic/sets/`, compartilhando apenas primitives realmente comuns.
- Trocar imports estáticos em `CinematicStage3D.tsx` por um registro tipado de carregadores associado a `CinematicSet`. Renderizar somente o ambiente ativo; manter fallback visual enquanto o chunk carrega ou falha.
- Manter o diretor, o estado temporal e as transições de câmera como fonte única do playback. Não duplicar relógio ou estado de partida em componentes de cena.
- Decompor `CutsceneStage.tsx` em orquestração de playback e componentes de diálogo/controles DOM, sem mover callbacks de frame frequentes para estado React global.
- Manter a ilustração de fallback lazy e separar por tipo de arte somente quando a fronteira reduzir a closure inicial medida; não criar chunks por componente pequeno.

### PlayerRig e página 3D

- Manter `player-rig-contract.ts`, `player-rig-face.ts` e `player-rig-meshes.ts` como fronteiras existentes, sem barrel imports no caminho quente.
- Deixar `PlayerRig.tsx` como composição R3F; extrair cálculo/seleção de pose e atualização por frame para uma unidade com interface explícita e testes próprios, sem alterar `useFrame` cadence, LOD, aparência ou seed do jogador.
- Preservar o carregamento lazy já existente em `MatchPlayers`. A entrada da página não importa o chunk do rig nem o WASM antes de haver uso de jogador 3D.
- Separar código por responsabilidade e acoplamento; não impor limites artificiais de linhas nem dividir arquivos apenas para mudar nomes.

### Rust/WASM e segurança

- Reutilizar `WASM_CAPABILITY.rigSection`, `loadGameWasm` e o Worker de geometria existente; não criar um segundo runtime nem carregar WASM no thread principal.
- Continuar validando buffers e limites antes e depois da fronteira WASM. Timeout, trap, ABI incompatível, dados inválidos ou resposta inesperada retornam ao fallback TS sem bloquear a primeira geometria visível.
- Instrumentar e comparar tanto o kernel quanto o fluxo completo usado pela página (reserva de lane, transferência, cálculo, retorno e construção de `BufferGeometry`). Só ativar `RUST_GEOMETRY_RELEASE` com ao menos três execuções comparáveis, ganho mediano mínimo de 20% no fluxo completo e nenhuma regressão na primeira imagem. Sem essa evidência, manter o gate desligado e reportar explicitamente que a execução ainda usa TS.
- Rust/WASM no cliente melhora isolamento/limites da rotina, mas não é uma fronteira de confiança para saves, resultados, autenticação, compras ou conquistas. Essas decisões continuam validadas no servidor; a partida permanece sequencial no Worker.

## Métricas e critérios de aceite

- Comparar closure estática da página de partida e da página/cena cinematográfica, além dos chunks sob demanda, em bytes e tamanhos Gzip/Brotli no mesmo build/configuração. O chunk de ambiente não selecionado não pode permanecer na closure estática da cena ativa.
- Adicionar workloads CodSpeed para geração de seção TS e WASM com entradas idênticas; comparar apenas execuções com ambiente compatível e registrar o commit exato. A medição de kernel não substitui a medição do fluxo completo nem certifica FPS/GPU física.
- Cobrir seleção de ambiente, carregamento/falha de chunk, compatibilidade visual do PlayerRig, limites de entrada/saída e paridade TS/WASM. Executar também TypeScript, lint, testes focados, testes Rust/WASM, build e gates de bundle.
- Nenhuma mudança em imagens/assets, dependências, deploy ou autoridade de gameplay. Publicação do PR continua em draft até os gates requeridos passarem; não reescrever histórico publicado.

## Fora de escopo

- Converter regras, RNG, saves, relógio, resultados, economia ou segurança de contas para WASM/Rust client-side.
- Alterar a simulação sequencial, a identidade dos jogadores, conteúdo visual ou formatos de save.
- Converter/comprimir imagens, remover dependências, modificar serviços Cloudflare/Firebase/Supabase ou publicar produção.
