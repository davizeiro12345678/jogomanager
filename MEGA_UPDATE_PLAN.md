# Mega Atualização: Gráfico 3D + Performance + Cutscenes — Plano Completo

> Data: 2026-09-25 · Branch: `arena/01a0da0b-jogomanager` · Base: `50ad5d4`
> Estado de partida verificado: `tsc -b` limpo, **152 testes passando (28 arquivos)**,
> `npm install` funcional (727 pacotes, `--legacy-peer-deps`).

---

## 1. Diagnóstico — o que existe hoje (inventário real do código)

### 1.1 Arquitetura de render

| Camada               | Arquivo                                                                                                                              | Estado                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Palco da partida     | `src/components/game/Stadium3D.tsx` (2.979 linhas)                                                                                   | Canvas R3F, sombras PCF, ACES, `frameloop="demand"` quando invisível, DPR por qualidade, contexto de orçamento de cena                                                                               |
| Jogadores herói      | `src/components/game/players/PlayerRig.tsx` (1.163 linhas)                                                                           | Esqueleto procedural de 22 juntas, LOD 0/1/2 por distância, IK contextual, materiais compartilhados, piscada, respiração, fadiga                                                                     |
| Jogadores distantes  | `src/components/game/players/LowPlayers.tsx` (294 linhas)                                                                            | 11 `InstancedMesh` para 22 atletas, silhueta articulada, contexto de contato parcial                                                                                                                 |
| Seleção de heróis    | `MatchPlayers.tsx`                                                                                                                   | Por cobertura de tela: **2 heróis em Alta, 3 em Cinema, 4 em replay**                                                                                                                                |
| Animação             | `animation-core.ts` + `animation.ts` (1.113) + `animation-extra.ts` (1.480) + `animation-extra2.ts` (1.452) + `animation-catalog.ts` | Biblioteca procedural grande; metadados de clipe existem, registro completo **não** (tarefa 1 do NEXT_STEPS em 70%)                                                                                  |
| IK                   | `src/game/ik-solver.ts` (313 linhas)                                                                                                 | Heurístico (`blendTo` para ângulos fixos), apoio de pé, goleiro, contato com bola, contrarotação                                                                                                     |
| Contrato visual      | `src/game/visual-context.ts` + `sim.ts` + `replay.ts`                                                                                | Determinístico, versionado, com testes (19)                                                                                                                                                          |
| Torcida              | `stadium/CrowdLod.tsx`                                                                                                               | 3 tiers de geometria, tiles com frustum, 5.120 instâncias máx, sway + pulso por shader                                                                                                               |
| Gramado              | `stadium/GrassChunks.tsx` + texturas canvas                                                                                          | 24 chunks de lâminas instanciadas com vento no vertex shader + tapete PBR com listras                                                                                                                |
| Batching             | `stadium/StaticBatch.tsx`                                                                                                            | Mescla geometria imutável por assinatura explícita                                                                                                                                                   |
| Pós                  | `post/PostFX.tsx` + `presets.ts`                                                                                                     | Bloom, N8AO, DOF (replay/drama), aberração, grão, vinheta, SMAA; presets match/replay/drama × dia/entardecer/noite                                                                                   |
| Câmeras              | `src/game/camera-modes.ts` (11 modos) + `broadcast-interest.ts` + `ShotHold`                                                         | TV, Diretor, Cinema, Trilho, Jogador, Gol, Tática, Skycam, Lateral, Arquibancada                                                                                                                     |
| Qualidade adaptativa | `RuntimeBudget.tsx` + `quality-governor.ts` + `runtime-scene-budget.ts` + `contracts/graphics-profile.ts`                            | Governor p95 em janelas de 2 s, 8 estágios, 4 tiers com alvos explícitos                                                                                                                             |
| Benchmark            | `scripts/graphics-benchmark.tsx` + `graphics-benchmark.html` + contrato                                                              | Fixture fixo Flamengo × Palmeiras, 1280×720 DPR 1, 4 cenários, `render_game_to_text`                                                                                                                 |
| Física               | `rapier-ball-authority.ts` no Worker                                                                                                 | Autoridade canônica da bola; sim dona de regras/placar/replay                                                                                                                                        |
| Cutscenes 2D         | `src/components/game/Cutscene.tsx` (1.005 linhas)                                                                                    | SVG com parallax, grão, vinheta, halation, tarjas, máquina de escrever, voz TTS com cache IDB + fallback `speechSynthesis`, teclado/toque, reduced-motion                                            |
| Cutscenes 3D         | `src/components/game/CinematicStage3D.tsx` (712 linhas)                                                                              | 6 cenários próprios (vestiário, túnel, coletiva, campo, arquibancada, diretoria), luzes práticas, figurantes articulados, "Diretor" que corta por fala com easing + tremor de mão + respiro de lente |
| WebGPU experimental  | `src/components/game/renderer.ts`                                                                                                    | `WebGPURenderer` opcional (opt-in em localStorage), fallback WebGL2, marca falha do driver                                                                                                           |

### 1.2 Medições atuais (`docs/graphics/`)

| Métrica           | `baseline.json` (antes) | `batch-c.json` (depois) | Alvo Alta (contrato) | Gap             |
| ----------------- | ----------------------- | ----------------------- | -------------------- | --------------- |
| Draw calls médios | 5.104                   | **715,6**               | ≤ 260                | **2,75× acima** |
| Triângulos médios | 21,95 M                 | **787,8 K**             | ≤ 850 K              | ✅ dentro       |
| p95 de frame      | 235,1 ms                | **63 ms**               | ≤ 28 ms              | **2,25× acima** |
| FPS médio         | 6,43                    | **21,9**                | 45                   | **2× abaixo**   |
| Long tasks        | 623 (98 s de 99 s)      | 3 (1,5 s)               | —                    | ✅ excelente    |
| First frame       | 3.493 ms                | 1.480 ms                | —                    | ✅ bom          |

**Leitura honesta:** os números vêm do navegador do host (renderização software, provavelmente
SwiftShader), então são um _piso_, não certificação de GPU física. Mesmo assim, a razão
draw-calls/p95 contra o contrato é o problema número 1: **715 draws não cabem no alvo de 260**.

### 1.3 Probleas e riscos encontrados (prioridade)

**P0 — bloqueiam a meta de performance**

1. **Draw calls 2,75× acima do orçamento.** O custo dominante é o `PlayerRig`: cada herói monta
   ~50–70 meshes individuais (cada membro tem músculo, manga, caneleira, cadarço, travas…).
   2 heróis ≈ 120 draws. Torcida: até 18 tiles × 3 tiers. Grama: 24 chunks. Props: anéis.
   **Não existe censo por subsistema** — o `FrameProbe` só agrega `renderer.info`.
2. **p95 63 ms vs 28 ms.** Sem atribuição por subsistema não se sabe se é fill-rate, sombra,
   vertex ou CPU. Faltam alavancas de governor para sombra (resolução/frustum), heróis
   (quantidade), e anisotropia.

**P1 — bloqueiam o "mega gráfico"** 3. **Caminho WebGPU está quebrado por construção.** `renderer.ts` cria `WebGPURenderer`, mas:

- `onBeforeCompile` (vento da grama `Stadium3D.tsx:95`, `:1570`, `CrowdLod.tsx:116`) **não é
  suportado** pelo WebGPURenderer em nenhum backend → ligar WebGPU perde o vento da grama e o
  balanço/pulso da torcida silenciosamente.
- `meshline` (usado em `Stadium3D.tsx`) é `ShaderMaterial` → também não suportado.
- `PostFX` já é protegido (`postOn = vis.postFx && backend === "webgl2"`), os shaders acima não.
- Conclusão: WebGPU hoje é experimental _quebrado_; precisa de port TSL ou gate por feature.

4. **Heróis = 2 em Alta.** No modo transmissão (o padrão), 20 de 22 atletas são cápsulas
   instanciadas. "Melhoria gráfica massiva" exige heróis baratos (merge por junta), não mais
   heróis caros.
5. **Catálogo de animação incompleto** (NEXT_STEPS tarefa 1, 70%): clipes sem metadados
   registrados, sem transições condicionais completas, sem testes de continuidade.
6. **IK é heurístico**, não dois-gomos com alvo: pé pode errar o chão, não travamento de
   passada (stance lock), sem marcadores de contato dirigindo o golpe.
7. **Cutscene 3D é uma ilha**: Canvas próprio (2º contexto WebGL + compile de shader),
   figurantes simplificados, não reusa `PlayerRig`/estádio/materiais; câmera fixa por cena.
   Não existe tratamento cinematográfico dos momentos do jogo (gol em slow-mo com letterbox).
8. **Pós não tem look moderno**: sem TAA/TRAA (r186), sem motion blur, sem anamórfico/streak,
   sem lens dirt, sem LUT de grading, sem volumetria de refletores, sem reflexo de pista molhada.
9. **Torcida sem reação contextual** (gol, cartão, quase-gol) além do pulso genérico.
10. **Zero assets reais**: `public/game-assets` não existe; todas as texturas são canvas
    procedural → teto de qualidade em grama/pele/tecido.

**P2 — produto** 11. Hierarquia de UI por fluxo (partida/carreira/home/loja) ainda é o mesmo cartão translúcido. 12. Números de camisa: `kitTexture(kit, number, name)` por jogador — risco de textura/material
por atleta em vez de atlas por time.

---

## 2. Pesquisa de estado da arte (com referências)

### 2.1 three.js r186 (release de 08/09/2026 — o projeto já está nela)

- `WebGPURenderer` com fallback automático WebGL2; **`RenderPipeline`** (ex-`PostProcessing`)
  substitui o `EffectComposer` com MRT e combinação automática de passes.
- Novo em r186: **Gaussian Splat** renderer/loader, `SunLight`, `softParticles()` em TSL,
  `OnBeforeRenderPipeline`, PCFSoftShadowMap removido no WebGPU (PCF agora é soft),
  `Snap Objects to Pixel Grid`, exemplos de **neblina volumétrica pós**, SSAO com blur.
- TRAA/TAAU (upscale temporal), `Lut3DNode`, `builtinAOContext`, `LightProbeGrid` para WebGPU.
- Fontes: [three.js r186 release](https://github.com/mrdoob/three.js/releases/tag/r186),
  [Migrate Three.js to WebGPU (2026)](https://www.utsubo.com/blog/webgpu-threejs-migration-guide),
  [three.js WebGPURenderer manual](https://threejs.org/manual/en/webgpurenderer.html).

### 2.2 O que o WebGPU **não** aceita (crítico para este repo)

- `ShaderMaterial`, `RawShaderMaterial` e **`onBeforeCompile`**: não suportados em nenhum backend.
- `EffectComposer` / pmndrs `postprocessing` / `@react-three/postprocessing`: só WebGLRenderer.
- `troika-three-text` (usado em `fonts.ts`): quebra por `onBeforeCompile`.
- `Environment` com filhos (cubemap) e `WebGLCubeRenderTarget`: quebrados desde r183.
- Fontes: [guia de migração](https://www.utsubo.com/blog/webgpu-threejs-migration-guide),
  [100 Three.js Tips 2026](https://www.utsubo.com/blog/threejs-best-practices-100-tips),
  [manual WebGPURenderer](https://threejs.org/manual/en/webgpurenderer.html).

### 2.3 Performance web (padrões aplicáveis)

- Draw calls: confortável < 100–150 no mobile; R3F prático: < 500, limite 1.000. Alvo deste
  projeto já é mais agressivo (260 em Alta) — exige merge por junta + instancing.
- **Merge por junta**: mesmas malhas sob o mesmo `group` compartilham transform → mesclar em 1
  malha por material não altera aparência e derruba draws (~60 → ~15 por herói).
- `BatchedMesh` (r159+, melhorado r170) para geometria variada com 1 material; instancing com
  _per-instance frustum culling_ e BVH; LOD com morph por distância.
- `frameloop="demand"` + `invalidate()`; cap de DPR; KTX2/Draco/gltf-transform; dispose sempre.
- Fontes: [Three.js Performance Optimization](https://www.hontran.dev/blog/three-js-performance-optimization),
  [Boosting R3F Mobile Performance 2026](https://krapton.com/blog/boosting-react-three-fiber-mobile-performance-in-2026-a-deep-dive-d6105c),
  [InstancedMesh2 (three.ez)](https://discourse.threejs.org/t/three-ez-instancedmesh2-enhanced-instancedmesh-with-frustum-culling-fast-raycasting-bvh-sorting-visibility-management-lod-skinning-and-more/69344).

### 2.4 Torcida (GPU Gems, ainda o padrão)

- Instancing com palette skinning via vertex texture fetch, LOD por distância, frustum culling
  por personagem; LOD de polígono **e** de iluminação para distantes.
  Fonte: [NVIDIA GPU Gems 3, Cap. 2 — Animated Crowd Rendering](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-2-animated-crowd-rendering).

### 2.5 Animação de jogador (decisão de arquitetura)

- **Motion matching / difusão (SMGDiff)**: estado da arte acadêmico, não viável em jogo browser
  determinístico (precisa de dataset + inferência). Fora de escopo.
- **Procedural + IK com travamento de pé** (stance lock, time-warping por perna, cadência por
  velocidade): o que este jogo já faz e deve evoluir — é o que sustenta determinismo e replay.
  Fontes: [Unity procedural soccer](https://discussions.unity.com/t/procedural-character-animation-soccer/769433),
  [tese Runevision (locomoção procedural/IK)](https://runevision.com/thesis/rune_skovbo_johansen_thesis.pdf),
  [SMGDiff (arXiv, para registro)](https://arxiv.org/html/2411.16216v1).

---

## 3. Metas mensuráveis (SLOs)

| #   | Meta                                   | Hoje                | Alvo                                    |
| --- | -------------------------------------- | ------------------- | --------------------------------------- |
| M1  | Draw calls médios em Alta (broadcast)  | 715,6               | **≤ 260**                               |
| M2  | p95 de frame em Alta                   | 63 ms               | **≤ 28 ms**                             |
| M3  | FPS médio em Alta                      | 21,9                | **≥ 45**                                |
| M4  | Draw calls por herói                   | ~60                 | **≤ 18** (merge por junta)              |
| M5  | Heróis articulados em Alta (broadcast) | 2                   | **≥ 6**                                 |
| M6  | Heróis em replay                       | 4                   | **≥ 10**                                |
| M7  | Triângulos em Alta                     | 787 K               | ≤ 850 K (manter)                        |
| M8  | Cinema: p95 / FPS                      | —                   | ≤ 33,3 ms / ≥ 30                        |
| M9  | First frame (benchmark)                | 1.480 ms            | ≤ 1.200 ms                              |
| M10 | Testes + typecheck + build             | 152 ✅              | verdes a cada fase                      |
| M11 | Replays antigos                        | ok                  | continuam ok (versionamento)            |
| M12 | WebGPU                                 | quebrado por shader | ou portado (TSL) ou gateado com verdade |

---

## 4. Plano de execução por fases

Cada fase termina com: `tsc -b`, `eslint`, `vitest`, `PFM_LOCAL_VERIFY=1 npm run build`,
benchmark do cenário afetado e registro em `docs/graphics/`. Nada de commit quebrado.

### Fase 0 — Instrumentação e censo (base para tudo)

- **Censo de draw calls por subsistema**: no `FrameProbe`/benchmark, agrupar `renderer.info`
  por nome de objeto (jogadores, torcida, grama, props, estático, pós) e exportar
  `docs/graphics/census.json` + overlay de dev com top-20 ofensores.
- **GPU timer opcional** (`EXT_disjoint_timer_query_webgl2`) atrás de flag para medir custo real
  de sombra vs fill vs vertex.
- **Teste de contrato do censo** (orçamento por subsistema: ex. herói ≤ 18 draws).
- **Saída:** sem censo não se aprova ganho visual nenhuma nas fases seguintes.

### Fase 1 — Performance destrutiva (M1–M3, M9)

1. **Merge por junta no `PlayerRig`**: mesclar malhas de cada junta por material em build
   (cache de geometria por `(look, quality, segs)`); detalhes finos (rosto, dedos, cadarços)
   continuam em grupos LOD separados. ~60 → ~15 draws por herói, mesma aparência.
2. **Atlas de número por time**: uma textura de camisa por equipe (número + nome em canvas),
   não por jogador; remove materiais/texturas duplicados.
3. **Sombra inteligente**: frustum de sombra apertado na região da ação (bola + 8 m),
   atualizado a cada 0,5 s; resolução por tier (2048 Alta / 1024 Cinema noturno opcional);
   só herói e poste/gol projetam.
4. **Torcida**: fundir tiles distantes em cards impostores; LOD de iluminação para longe
   (flatShading já existe); pular update de tiles fora do frustum sem sort caro.
5. **Governor**: novas alavancas — resolução de sombra, contagem de heróis, tiles de torcida,
   anisotropia, `post` já existe; garantir que cada estágio realmente remova trabalho.
6. **`frameloop="demand"`** quando o jogo está pausado/menu aberto (além de aba oculta).
7. **Medir** cada mudança no benchmark (`baseline`, `broadcast`, `director`, `cinema`) e
   registrar `batch-d.json`.

### Fase 2 — Jogadores: gráfico massa (M4–M6)

1. **Mais heróis baratos**: com Fase 1, subir `heroPlayers` (Alta 2→6, Cinema 3→8,
   replay 4→10) com histerese de tela já existente.
2. **Materiais cinema**: `MeshPhysicalMaterial` com _sheen_ (tecido), _clearcoat_ (bota/chuva),
   variação de roughness por suor/poeira; cache por `(look, kit)` para não multiplicar programas.
3. **Rosto/cabelo** LOD0: lábios, sobrancelha, cabelo em mechas, córnea especular, orelha,
   mandíbula articulada (já existe base — refinar).
4. **Uniforme**: texturas de tecido (normal/roughness canvas), colarinho, meião com tapa,
   caneleira, luva de GK com fecho, número em atlas.
5. **Testes**: determinismo de `lookFor`/`proportionsFor`, cache não vaza geometria
   (dispose em unmount).

### Fase 3 — Animação e IK (qualidade de movimento)

1. **Fechar o catálogo** (tarefa 1 do NEXT_STEPS): registrar todos os clipes com metadados
   (família, loop, duração, prioridade, marcadores, interrompível), `selectClipFromContext`,
   `canTransition`, `calculateBlendWeight`; transições condicionais por velocidade/stamina/
   contexto; sem _popping_.
2. **IK de dois gomos com alvo**: pé → alvo no chão (y=0) com _stance lock_ durante apoio e
   swing livre; mão/braço para alvo de cabeçada; goleiro com arco de mergulho + queda +
   recuperação; contato da bola no marcador exato (posição da bola em `actionT`).
3. **Marcadores de contato** dirigindo IK e efeitos (impacto, poeira, som) em vez de `u` genérico.
4. **Clipes faltantes**: slide tackle, disputa/ombro, domínio, dribles curtos, arremesso
   lateral, escanteio, barreira, comemorações (parcial), cãibra/lesão.
5. **Testes determinísticos**: limites angulares (`isPoseValid`), continuidade de pose entre
   clipes, cadência sem patinação.

### Fase 4 — Estádio, torcida e ambiente

1. **Gramado**: PBR com normal/roughness de melhor qualidade, desgaste por zona (área, meio),
   lama visível em molhado, poças com reflexo (planar reflector barato ou env), listras.
2. **Redes**: deformação por impacto (shader com impulso) + vento; trave/travessão metálicos.
3. **Publicidade**: placas LED com animação de conteúdo por textura (offset UV), patrocínio do
   clube (já existe `sponsors`).
4. **Refletores noturnos**: cone volumétrico aditivo + halation no pós; céu com estrelas/nuvens.
5. **Torcida contextual**: onda de gol por tile com atraso, vaia no cartão, "oooh" no quase-gol,
   tifo/mosaico por clube, luzes de celular à noite.
6. **Clima**: chuva (partículas + respingos), neve, neblina (já existe), vento em bandeiras.

### Fase 5 — Pós-processamento e câmera

1. **Novo look**: TAA/TRAA ( Cinema), motion blur em câmera rápida, _anamórfico streak_,
   _lens dirt_, LUT de grading por momento (transmissão vs cinema), DOF opcional no jogo,
   grão animado, halation, _snap to pixel grid_ (r186).
2. **Presets**: `broadcast` (nítido, cor de TV), `cinema` (letterbox + streak + grão),
   `replay`, `drama`, `noite`, `chuva` — sem recriar composer por quadro (já é `useMemo`).
3. **Câmera**: Diretor com cortes por interesse (já existe `broadcastInterest`/`ShotHold`) +
   slow-mo no gol, _netcam shake_, replays com tratamento cinematográfico e letterbox.
4. **WebGPU**: decisão do usuário (ver perguntas) — port TSL dos 3 shaders ou gate por backend.

### Fase 6 — Cutscenes: mega evolução

1. **Unificar palco**: no modo `cinematic` sobre a partida, reutilizar o Canvas/estádio existente
   (troca de rig de câmera) em vez de montar um 2º Canvas — elimina 2º contexto WebGL, compile
   duplicado e divergência visual.
2. **Motor de timeline data-driven**: cenas como dados (planos, duração, easing, atores, áudio,
   legendas) substituindo `SHOTS` fixos; transições reais (corte, dissolve, fade, whip pan,
   _match cut_), ritmo por fala, skip/auto-avanço, reduced-motion, legenda com retrato.
3. **Momentos cinematográficos do jogo**: gol (slow-mo multi-ângulo com Diretor + letterbox),
   pênalti, cartão vermelho, substituição, levantamento de taça, acesso/rebaixamento.
4. **Atores reais**: figurantes das cutscenes usam `PlayerRig`/proporções reais quando o palco
   é o campo/vestiário; iluminação compartilhada.
5. **Áudio/voz**: manter TTS com cache IDB + fallback; misturar com ambiente (torcida) por cena.

### Fase 7 — UI/UX, assets e verificação final

1. **UI por fluxo**: placar/feed/controles da partida, dashboard de carreira, home, loja, editor
   com hierarquia própria; estados vazios/erro/offline; teclado + toque; contraste; reduced motion.
2. **Assets**: `ATTRIBUTION.md`; opcionalmente texturas CC0/CC-BY locais via pipeline KTX2/Meshopt
   (gate `scripts/verify-game-assets.mjs` já existe) — **sem asset remoto obrigatório em runtime**.
3. **Verificação final**: typecheck, lint, suíte completa, build, benchmark dos 4 cenários,
   replays antigos/novos, WebGL2 (+WebGPU se aprovado), revisão de acessibilidade.

---

## 5. Riscos e mitigações

| Risco                                              | Mitigação                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| Merge por junta quebrar animação                   | Mesclar só malhas sob a mesma junta rígida; teste de snapshot de pose |
| Subir heróis derrubar FPS                          | Só depois do censo + merge; governor reduz heróis como alavanca final |
| WebGPU gastar tempo sem retorno                    | Decisão explícita do usuário; sem port, manter gateado e documentado  |
| Catálogo de animação reintroduzir não-determinismo | Testes de determinismo + versionamento de replay                      |
| Cutscene unificada quebrar cenas existentes        | Feature flag + fallback para o palco isolado atual                    |
| Assets externos violarem licença                   | `ATTRIBUTION.md` + gate de intake; nada remoto obrigatório            |
| Regressão visual não percebida                     | Screenshots antes/depois por cenário no benchmark                     |

## 6. Verificação (gate de cada fase)

1. `npm exec -- tsc -b --pretty false`
2. `npm run lint`
3. `npm test` (suíte sem stress) + `npm run test:stress` quando tocar em sim
4. `PFM_LOCAL_VERIFY=1 npm run build`
5. Benchmark: `npm exec -- vite build --config scripts/graphics-vite.config.ts` + cenários
   `baseline`/`broadcast`/`director`/`cinema`, resultado em `docs/graphics/`
6. Revisão manual de acessibilidade e das telas principais

## 7. Fora de escopo (explícito)

- Não reescrever história publicada (Lovable) nem force-push.
- Não alterar resultado esportivo/placar sem teste determinístico e decisão explícita.
- Não adicionar assets remotos obrigatórios em runtime.
- Não prometer certificação em Android físico ou GPU real sem medir neles.
- Não remover fallback WebGL2, LOD baixo ou suporte a replays antigos.

---

## 8. Decisões do usuário (2026-09-25)

| Pergunta   | Decisão                                                                           | Consequência no plano                                                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Prioridade | **Gráfico e performance primeiro** (os dois em paralelo, não sequencial)          | Fases 1 e 2 avançam juntas; cada ganho visual precisa de medição de custo junto                                                                                                            |
| Animação   | **Híbrido com GLB** (SkinnedMesh + clipes nos heróis, procedural nas LODs baixas) | Fase 3 inclui rig esquelético com mixer; a biblioteca procedural existente é assada em clipes primeiro (funciona sem asset algum) e um loader GLB CC0 entra pelo pipeline de intake depois |
| WebGPU     | **Port TSL** (investir para valer)                                                | Fase 5 inclui port dos 3 shaders `onBeforeCompile` (grama, anúncios, torcida) + `meshline` para node materials e avaliação de `RenderPipeline`                                             |
| Heróis     | **Aumentar só após otimização medida**                                            | Fase 1 (merge por junta) antecede Fase 2 (mais heróis): 6 Alta / 8 Cinema / 10 replay                                                                                                      |
| Cutscenes  | **Evoluir massivamente o motor e tudo**                                           | Fase 6 cobre motor de timeline, unificação com a partida **e** momentos cinematográficos do jogo (gol, pênalti, cartão, taça)                                                              |
| Assets     | **Pipeline completo** (GLB + KTX2/Meshopt)                                        | Fase 7 inclui pipeline de intake com `ATTRIBUTION.md`, gate já existente e fallback procedural intacto                                                                                     |

### Ordem de execução revista

Como gráfico e performance andam juntos, a entrega é medida em **lotes verificáveis**,
cada um com tipo/teste/build/benchmark:

1. ~~**Lote A — Medir e baratear o herói**~~ ✅ **entregue e medido** (2026-09-25): censo de
   draw calls por subsistema (`scene-census.ts`), merge de geometria por junta (`rig-body.ts`,
   `rig-geometry.ts`) e materiais de detalhe compartilhados com cache LRU
   (`rig-materials.ts`). `StadiumProps` passou por `StaticBatch` (grades, camarotes, portões e
   cobertura).
2. **Lote B — Mais heróis, medidos**: subir `heroPlayers`/`replayHeroPlayers` com o custo novo,
   governor com contagem de heróis como alavanca. (Metas M5, M6.)
3. **Lote C — Rig esquelético híbrido** ✅ **SkinnedMesh entregue** (2026-09-25): o corpo do
   atleta passou a ser rendido como `SkinnedMesh` (`rig-skin.ts`) — 18 grupos de desenho por
   herói contra 53 malhas da versão mesclada por junta e ~117 do rig original. A animação
   procedural continua dona da pose (os ossos são escritos pelo mesmo código de antes) e a pose
   de bind é idêntica, verificada vértice a vértice em teste. **Pendente**: `AnimationMixer` com
   clipes assados da biblioteca procedural + loader GLB pelo intake de assets.
4. **Lote D — IK e catálogo**: dois gomos com _stance lock_, marcadores de contato, catálogo
   completo com transições condicionais. (Movimento.)
5. **Lote E — Estádio e torcida**: gramado, redes, publicidade LED, refletores, reações.
6. **Lote F — Pós e câmera + WebGPU TSL**: look moderno e port dos shaders.
7. **Lote G — Cutscenes**: timeline data-driven, unificação com a partida, momentos do jogo.
8. **Lote H — Assets, UI e verificação final**.

## 8.1 Registro medido dos lotes (atualizado a cada entrega)

### Lote A — hero e props (entregue 2026-09-25)

| medição | antes | depois |
| --- | --- | --- |
| malhas do atleta em LOD0, qualidade alta | ~117 | **54** (mediana 53 sobre 36 combinações de pele/penteado/manga) |
| malhas do atleta sem `hi` | ~110 | **52** |
| materiais de detalhe por aparência | 1 por peça inline | 1 por aparência (cache LRU 64) |
| props do estádio (grades, camarotes, portões, cobertura) | 43 literais `<mesh>` multiplicados pelos anéis ≈ **130 desenhos** | mesclados por aparência dentro do `StaticBatch` |
| triângulos do atleta LOD0 | — | 14.588 (18 materiais distintos) |

Verificação: `rig-body.test.ts` (8 testes, inclusive o teto de 54 malhas por aparência e a
invariante "variantes de estilo não somam malhas"), `scene-census.test.ts`, typecheck, suíte sem
estresse (171 testes / 31 arquivos), build de produção, ESLint nos arquivos tocados.

### Lote B — heróis derivados do orçamento (entregue 2026-09-25)

Subir `heroPlayers` às cegas foi exatamente o erro do orçamento original: **6 heróis × 54
desenhos = 324 desenhos**, acima dos 260 do tier Alta. A contagem agora é derivada, não fixa:

- `src/game/draw-budget.ts` — `allocateHeroes(maxDraws, nonHeroDraws, cap, min)` puro e testado:
  quantos heróis cabem = `maxDraws × 0,95 − desenhos fora dos heróis`, dividido pelo custo medido
  de 54, sempre entre `min` e o teto do tier.
- `MatchPlayers.tsx` mede `gl.info.render.calls` a cada 0,5 s (fora do caminho quente), desconta
  os heróis já montados e reavalia o limite com histerese (3 amostras para subir, queda
  imediata).
- Tetos em `runtime-scene-budget.ts`: 6 (alta), 8 (cinema), 10 (replay alta), 3 (média), 0
  (baixa). O governor mantém a escala por estágio (0,66 no 7, 0,5 no 8).

Consequência honesta e registrada: **com o custo atual de 54 desenhos por herói, o tier Alta
paga 3–4 heróis em rig completo, não 6**. Para chegar em 6–8 heróis sem estourar o orçamento, o
rig precisa virar `SkinnedMesh` (1 desenho por grupo de material, ~6 por atleta) — que é o
**Lote C**, já previsto na decisão de animação híbrida do usuário. As metas M5/M6 portanto
dependem do Lote C; o alocador entrega o máximo possível agora e passa a render 6 heróis
automaticamente quando o custo cair.

### Lote C — SkinnedMesh (entregue 2026-09-25)

| medição | rig original | malha mesclada por junta | SkinnedMesh |
| --- | --- | --- | --- |
| desenhos por herói (LOD 0) | ~117 | 53 | **18** |
| desenhos por herói com sombra | ~117 | 106 | **30** (só os 12 grupos "core" projetam) |
| heróis cabem no Alto (260) | 2 | 3–4 | **6** |
| triângulos / vértices | — | — | idêntico (mesma geometria, mesma pose) |

Como: cada junta vira um `THREE.Bone` com o mesmo pivô e a mesma hierarquia dos grupos que a
animação já escrevia, e as peças são agrupadas por (material, nível de LOD). A matriz de bind é
a translação do atleta; o three.js mantém `bindMatrixInverse` em sincronia, então o atleta pode
continuar se movendo sem reconstruir a malha.

Verificação (`rig-skin.test.ts`, 8 testes): pose de bind = identidade; hierarquia de ossos com os
pivôs espelhados; todo vértice dependente de exatamente um osso; girar o joelho deforma só o que
está abaixo dele; contagem de vértices idêntica à da malha mesclada; e o teste forte — simulando
o vertex shader, **cada vértice cai exatamente onde caía na malha mesclada** (desvio < 0,0001).
Mais: 180 testes / 32 arquivos, typecheck, build e ESLint verdes.

### Lote G (início) — motor de timeline das cutscenes (entregue 2026-09-25)

O motor de cutscenes era orientado a clique com três efeitos independentes
(toque, máquina de escrever em `setInterval`, travelling em `requestAnimationFrame`).
Agora a cena é uma **linha do tempo** em `src/game/cutscene-timeline.ts`:

- `buildCutsceneTimeline(scene, durations)` — cada fala ganha instante de início,
  duração de leitura (ritmo por locutor: comentarista é mais rápido, narrador mais
  lento), pausa, enquadramento e efeito; quando a voz real existe, ela manda na
  duração da fala.
- `sampleCutsceneTimeline(timeline, t)` — estado completo num instante: fala atual,
  progresso, caracteres digitados e travelling da câmera (smoothstep).
- `advanceTarget(timeline, t, typed)` — o "pular" conserva a regra que as pessoas
  esperam: o primeiro toque completa a digitação, o segundo vai para a próxima fala.

`Cutscene.tsx` passou a ter **um único relógio** (`requestAnimationFrame`) alimentando
as três coisas, e a timeline é remontada quando a duração do áudio chega — a cena
avança sozinha no ritmo do roteiro, com o toque como atalho. Determinismo testado:
a mesma cena produz sempre o mesmo filme.

Verificação: `cutscene-timeline.test.ts` (11 testes — falas encaixadas sem falha nem
sobreposição, janela de leitura sadia em todas as 20 cenas, determinismo, voz real
versus estimativa, monotonicidade do tempo, digitação gradual, suavização da câmera,
regra do pular, enquadramentos alternados, clamp de tempo). Suíte: 191 testes / 33
arquivos, typecheck, build e ESLint verdes.

**Pendente no Lote G**: unificação com a partida (a timeline como fonte dos momentos
cinematográficos dentro do jogo) e beats de efeito/ator na linha do tempo.

## 9. Perguntas de decisão

Respondidas em 2026-09-25 — ver tabela da seção 8. Nenhuma pergunta em aberto.
