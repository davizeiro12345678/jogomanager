# Next Steps - Stadium Stewards Mega Evolution

## Status Atual

### ✅ Concluído (5 commits)

1. **Contrato visual da engine** (100%)
   - `visual-context.ts` - Tipos completos (ActionContext, ContactContext, VersionedVisualData)
   - `sim.ts` - `generateVisualContext()` determinístico
   - `replay.ts` - Versionamento e migração de dados
   - `visual-context.test.ts` - 19 testes de determinismo

2. **PlayerRig Cinema** (80%)
   - `ik-solver.ts` - Módulo de IK reutilizável (220 linhas)
   - `PlayerRig.tsx` - Integração com contexto visual
   - Apoio de pés, foco contextual, equilíbrio
   - Goleiros: mergulho, salvada (parcial)

3. **Animações e catálogo** (70%)
   - `animation-core.ts` - Metadados (ClipMarker, ClipMetadata, AnimationFamily, JOINT_LIMITS)
   - `animation-catalog.ts` - Sistema de catálogo organizado por famílias
   - Marcadores padrão para: shot, pass, dribble, tackle, save
   - Funções: selectClipFromContext(), canTransition(), calculateBlendWeight()

4. **LOD baixo e performance** (60%)
   - `LowPlayers.tsx` - Integração com contexto visual
   - Uso de groundFoot e contactForce para ajuste de pernas
   - Instancing mantido

5. **Documentação** (100%)
   - `plan.md` - Atualizado com progresso

### 📊 Estísticas
- **Testes**: 34/34 passando ✅
- **Typecheck**: Sem erros ✅
- **Commits**: 5 novos commits pushados
- **Linhas de código**: ~1000+ adicionadas

---

## 🎯 Próximas Tarefas (Prioridade)

### Alta Prioridade (Bloqueiam o Cinema)

#### Tarefa 1: Animações e Catálogo (70% → 100%)
- [ ] Reorganizar `animation.ts`, `animation-extra.ts`, `animation-extra2.ts` para usar o catálogo
- [ ] Adicionar metadados a cada clipe (família, duration, priority, markers)
- [ ] Criar função `registerClips()` para popular ANIMATION_CATALOG
- [ ] Testes de transição entre clipes
- [ ] Testes de continuidade de pose

**Arquivos a modificar:**
- `src/game/animation.ts`
- `src/game/animation-extra.ts`
- `src/game/animation-extra2.ts`
- `src/game/animation-catalog.ts`

**Testes a criar:**
- `src/game/animation-catalog.test.ts`

---

#### Tarefa 2: LOD Baixo e Performance (60% → 100%)
- [ ] Adicionar níveis intermediários de detalhe (LOD 1, 2, 3)
- [ ] Implementar LOD dinâmico por distância
- [ ] Medir draw calls, triângulos, frame time
- [ ] Adicionar métricas de performance por qualidade

**Arquivos a modificar:**
- `src/components/game/players/LowPlayers.tsx`

**Novo arquivo:**
- `src/game/performance-metrics.ts`

---

### Média Prioridade

#### Tarefa 3: Modelo, Materiais e Assets Locais (0% → 100%)
- [ ] Evoluir `player-model.ts` com perfis corporais determinísticos
- [ ] Adicionar assimetria sutil, cabelo, barba, rosto
- [ ] Evoluir `player-materials.ts` com tecido, suor, pele
- [ ] Adicionar assets CC0/CC-BY locais
- [ ] Criar arquivo de atribuição (ATTRIBUTION.md)

**Arquivos a modificar:**
- `src/game/player-model.ts`
- `src/game/player-materials.ts`

**Novo arquivo:**
- `ATTRIBUTION.md`

---

#### Tarefa 4: Torcida, Gramado, Redes e Ambiente (0% → 100%)
- [ ] Melhorar reação da torcida por evento contextual
- [ ] Adicionar resposta de contato à grama
- [ ] Melhorar redes com deformação física limitada
- [ ] Integrar materiais em Stadium3D.tsx e Props.tsx

**Arquivos a modificar:**
- `src/components/game/stadium/Stadium3D.tsx`
- `src/components/game/stadium/Props.tsx`
- `src/components/game/stadium/Crowd.tsx` (se existir)

---

### Baixa Prioridade

#### Tarefa 5: Pós-processamento e Câmera (0% → 100%)
- [ ] Criar presets separados (transmissão, Cinema, replay, drama, chuva, noite)
- [ ] Revisar PostFX, exposição, fog, sombras
- [ ] Adicionar validação visual por screenshot

**Arquivos a modificar:**
- `src/components/game/post/PostFX.tsx`
- `src/components/game/post/presets.ts`

---

#### Tarefa 6: UI/UX do Produto Inteiro (0% → 100%)
- [ ] Partida: redesign de placar, feed, controles
- [ ] Carreira: dashboard, elenco, tática, treino
- [ ] Produto: home, loja, editor, cutscenes

**Arquivos a modificar:**
- `src/routes/match.tsx`
- `src/routes/dashboard.tsx`
- `src/routes/index.tsx`
- `src/components/ui/hud.tsx`
- `src/components/game/GameShell.tsx`

---

#### Tarefa 7: IA e Comportamento (0% → 100%)
- [ ] Revisar antecipação, orientação corporal
- [ ] Melhorar desmarque, duelos, cobertura
- [ ] Testar 200+ partidas com replay

**Arquivos a modificar:**
- `src/game/sim.ts` (novas funções de IA)

---

#### Tarefa 8: Verificação Final (0% → 100%)
- [ ] Rodar typecheck, lint, build completo
- [ ] Validar snapshots de replay antigo e novo
- [ ] Testar WebGL2/WebGPU
- [ ] Testar desktop/mobile
- [ ] Benchmark de performance
- [ ] Revisão manual de acessibilidade

---

## 📅 Roadmap Sugerido

### Semana 1-2: Animações e Catálogo
- Foco: Concluir Tarefa 1
- Objetivo: Todos os clipes organizados e testados

### Semana 3-4: LOD e Performance  
- Foco: Concluir Tarefa 2
- Objetivo: LOD dinâmico funcionando com métricas

### Semana 5-6: Modelo e Materiais
- Foco: Concluir Tarefa 3
- Objetivo: Assets locais e aparência aprimorada

### Semana 7-8: Ambiente
- Foco: Concluir Tarefa 4
- Objetivo: Torcida, grama e redes realistas

### Semana 9-10: Pós-processamento e UI
- Foco: Concluir Tarefas 5-6
- Objetivo: Visual polido e UI/UX completa

### Semana 11-12: IA e Verificação
- Foco: Concluir Tarefas 7-8
- Objetivo: Produto pronto para produção

---

## 🚀 Como Contribuir

Para continuar o desenvolvimento:

```bash
# Instalar dependências
npm install

# Rodar testes
npm test

# Verificar tipos
npx tsc --noEmit

# Rodar localmente
npm run dev
```

---

## 📝 Notas

- Todos os commits devem seguir o padrão: `feat:` ou `fix:` ou `docs:`
- Todos os testes devem passar antes de push
- O typecheck deve estar limpo
- Manter determinismo em todas as alterações
- Não quebrar compatibilidade com replays antigos
