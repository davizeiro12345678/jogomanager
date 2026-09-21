## Plano: Mega evolução do jogador e produto

Reconstruir o sistema visual completo com foco hiper-realista próximo: jogadores, animações, torcida, grama, rede, pós-processamento, engine visual, replay e produto inteiro. A simulação poderá ganhar dados e ajustes de comportamento determinísticos para alimentar o visual, sem quebrar placar, regras ou compatibilidade dos saves. Assets CC0/CC-BY rastreáveis serão locais e o perfil Cinema priorizará desktop, com fallback forte por LOD para mobile.

**Diagnóstico confirmado**
- `PlayerRig.tsx` já possui anatomia procedural, 22 juntas, blend de clipes, LOD por distância, gaze, fadiga e materiais compartilhados, mas ainda não possui IK de apoio, correção de contato, pé dominante, alvo de ação ou foco visual contextual.
- `LowPlayers.tsx` possui instancing e articulação própria, porém usa uma locomação simplificada e não compartilha a mesma semântica de pose/contato da Alta.
- `animation-core.ts` descreve ângulos, mas não estados de apoio, contato, trajetória ou marcadores de eventos.
- `sim.ts` possui `action`, `actionT`, `actionDur`, velocidade, posse e stamina; falta um contrato visual determinístico com alvo, ponto de impacto, pé usado e resultado da ação.
- `replay.ts` já preserva tempos de ação, mas precisa versionar os novos dados visuais sem quebrar replays antigos.
- `player-model.ts` e `player-materials.ts` têm variação procedural e cache, mas ainda podem ganhar perfis de rosto, tecido, suor, cabelo e silhueta direcionados ao Cinema.
- A UI da partida, carreira, home, loja, editor e cutscenes já compartilha tokens, mas precisa de hierarquia própria por fluxo em vez de aplicar o mesmo cartão translúcido a tudo.

**Decisões**
- Prioridade: tudo em paralelo, com fases verificáveis.
- Direção: hiper-realismo próximo, com leitura de transmissão preservada.
- Assets: CC0/CC-BY rastreáveis, locais e registrados; sem dependência remota em runtime.
- Engine: revisão profunda de comportamento e contexto visual, mantendo determinismo, regras, placar e saves.
- Performance: Cinema desktop como referência; Alta/Média/Baixa continuam funcionais com LOD, instancing e fallback.
- UI/UX: produto inteiro, incluindo home, partida, carreira, loja, editor, cutscenes e páginas principais.

**Progresso**
- ✅ **Contrato visual da engine** (100%)
  - Criado `visual-context.ts` com ActionContext, ContactContext, VersionedVisualData
  - Implementado `generateVisualContext()` em `sim.ts`
  - Adicionado versionamento e migração em `replay.ts`
  - Testes de determinismo e compatibilidade com replays antigos
  
- ✅ **PlayerRig Cinema** (80%)
  - Criado `ik-solver.ts` com módulo de IK reutilizável
  - Integrado contexto visual no PlayerRig.tsx
  - Adicionado apoio de pés, foco contextual, equilíbrio
  - Goleiros com IK específico (parcial - mergulho, salvada)
  
- ✅ **Animações e catálogo** (40%)
  - Ampliado `animation-core.ts` com metadados (ClipMarker, ClipMetadata, AnimationFamily)
  - Adicionado JOINT_LIMITS e funções de validação de pose
  - Falta: reorganizar clipes por famílias e criar transições condicionais
  
- ✅ **LOD baixo e performance** (60%)
  - Integrado `LowPlayers.tsx` com contexto visual
  - Adicionado uso de groundFoot e contactForce para ajuste de pernas
  - Mantido instancing e performance
  - Falta: níveis intermediários de detalhe e medições de performance

- ⏳ **Modelo, materiais e assets locais** (0%)
- ⏳ **Torcida, gramado, redes e ambiente** (0%)
- ⏳ **Pós-processamento e câmera** (0%)
- ⏳ **UI/UX do produto inteiro** (0%)
- ⏳ **IA e comportamento** (0%)
- ⏳ **Verificação final** (0%)

**Plano de execução**
1. **Contrato visual da engine**
   - Criar tipos para `ActionContext`/`ContactContext` com pé dominante, alvo, direção, fase, ponto de contato, intensidade, resultado e reação.
   - Emitir esses dados de forma determinística em `sim.ts`, preservando `actionT/actionDur` e adicionando migração/versionamento em `replay.ts`.
   - Separar dados que alteram comportamento da IA dos dados somente visuais; escrever testes para garantir que o novo contexto não altera placar quando usado em modo visual.

2. **PlayerRig Cinema**
   - Extrair um módulo de pose/IK reutilizável para apoio dos pés, joelhos, tornozelos e contato com o gramado/bola.
   - Adicionar estabilização de pé, transferência de peso, antecipação de contato, recuperação após chute/passe, reação de equilíbrio e foco contextual cabeça/peito/braços.
   - Usar marcadores de ação para sincronizar golpe, contato, follow-through e aterrissagem, sem depender apenas de `u` genérico.
   - Melhorar goleiros com cadeia específica de mergulho, extensão, queda, encaixe e recuperação.

3. **Animações e catálogo**
   - Ampliar `animation-core.ts` para suportar metadados de clipe, marcadores de contato, loop, entrada, saída e prioridade.
   - Reorganizar `animation.ts`, `animation-extra.ts` e `animation-extra2.ts` por famílias: locomoção, domínio, passe, finalização, disputa, defesa, goleiro, comemoração e recuperação.
   - Criar transições condicionais por velocidade, stamina, contexto da bola, contato e reação da IA; impedir popping entre clipes.
   - Adicionar testes determinísticos de pose, continuidade e limites angulares.

4. **LOD baixo e performance**
   - Fazer `LowPlayers.tsx` consumir o mesmo contrato de contexto, mantendo instancing e materiais leves.
   - Melhorar silhouette, passada, braços, cabeça, goleiro e contato em baixa sem copiar a árvore pesada da Alta.
   - Adicionar níveis intermediários de detalhe para cabeça/torso/pernas e limites por distância, câmera e perfil Cinema.
   - Medir draw calls, triângulos, frame time e memória por qualidade.

5. **Modelo, materiais e assets locais**
   - Evoluir `player-model.ts` com proporções, assimetria sutil, perfis corporais, cabelo, barba, rosto e pé dominante determinísticos.
   - Evoluir `player-materials.ts` com tecido, suor, pele, cabelo, chuteiras, luvas e variações de roughness/normal sem criar material por jogador.
   - Adicionar assets CC0/CC-BY locais para texturas e referências, com arquivo de atribuição e fallback procedural.
   - Validar compatibilidade WebGL2/WebGPU e carregamento sob demanda.

6. **Torcida, gramado, redes e ambiente**
   - Melhorar reação da torcida por evento contextual: gol, chance, defesa, cartão, pressão e fim de jogo.
   - Dar à grama resposta de contato, desgaste e chuva; melhorar redes com deformação física limitada, vento e impacto da bola.
   - Integrar materiais, sombras, refletores, clima, câmera e pós-processamento em `Stadium3D.tsx`, `Props.tsx` e módulos de textura.
   - Preservar instancing e reduzir custo fora do enquadramento.

7. **Pós-processamento e câmera**
   - Criar presets separados para transmissão, Cinema, replay, drama, chuva e noite, evitando bloom/DOF excessivos durante o jogo normal.
   - Revisar `PostFX`, presets, exposição, fog, sombras e câmeras para manter bola, linhas e jogadores legíveis.
   - Adicionar validação visual por screenshot para broadcast, tática, gol, torcida, trilho, replay e cutscene.

8. **UI/UX do produto inteiro**
   - Partida: redesign de placar, feed, controles, estatísticas, replay, câmera, gráficos, substituições e mobile.
   - Carreira: dashboard, elenco, tática, treino, mercado, finanças, diretoria, notícias e histórico com hierarquia própria.
   - Produto: home, loja, editor, cutscenes, autenticação e páginas públicas com direção compartilhada, mas sem transformar fluxos operacionais em marketing.
   - Garantir estados vazios, loading, erro, offline, teclado, toque, contraste, reduced motion e não sobreposição.

9. **IA e comportamento**
   - Revisar antecipação, orientação corporal, desmarque, duelos, cobertura, reação defensiva e recovery para que a animação tenha contexto real.
   - Manter a engine determinística e testar 200+ partidas, incluindo replay e fallback local.
   - Separar mudanças de resultado esportivo das melhorias puramente visuais e documentar as decisões.

10. **Verificação final**
   - Rodar typecheck, lint, testes completos e build.
   - Validar snapshots de replay antigo e novo, WebGL2/WebGPU, desktop/mobile e perfis Cinema/Alta/Média/Baixa.
   - Executar sessões longas em GPU física quando disponível, coletando FPS médio, p95, 1% low, draws, triângulos e memória.
   - Fazer revisão manual de acessibilidade e screenshots antes/depois para home, carreira, partida, cutscene e loja.

**Arquivos principais**
- `src/components/game/players/PlayerRig.tsx` — rig Cinema, IK, foco, contatos e transições.
- `src/components/game/players/LowPlayers.tsx` — rig instanciado e LOD baixo.
- `src/game/animation-core.ts` — metadados, marcadores e utilidades de pose.
- `src/game/animation.ts`, `src/game/animation-extra.ts`, `src/game/animation-extra2.ts` — catálogo e estados.
- `src/game/sim.ts` — contrato de contexto visual e comportamento determinístico.
- `src/game/replay.ts` — versionamento e compatibilidade dos novos dados.
- `src/game/player-model.ts`, `src/game/player-materials.ts` — aparência, proporções e cache.
- `src/components/game/Stadium3D.tsx`, `src/components/game/stadium/Props.tsx` e `src/components/game/stadium/textures/*` — ambiente, torcida, gramado e redes.
- `src/components/game/post/PostFX.tsx`, `src/components/game/post/presets.ts` — imagem e presets.
- `src/routes/match.tsx`, `src/components/game/GameShell.tsx`, `src/components/ui/hud.tsx`, `src/routes/index.tsx`, `src/routes/dashboard.tsx` — UI/UX principal.
- `src/game/visual-settings.ts` — perfis, LOD, qualidade e preferências.

**Verificação**
1. Testes unitários de contexto de ação, pose, IK, continuidade, replay e determinismo.
2. Typecheck, ESLint e build de produção.
3. Screenshots e inspeção manual dos oito fluxos principais em desktop e mobile.
4. Benchmark por perfil e GPU, com limite explícito de custo para Cinema.
5. Checagem de licença/atribuição de cada asset local.

**Escopo excluído**
- Não usar assets remotos obrigatórios em runtime.
- Não alterar resultado esportivo sem teste determinístico e decisão explícita.
- Não remover o fallback procedural, o LOD baixo ou o suporte WebGL2.
