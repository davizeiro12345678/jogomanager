# JogoManager Upgrade Implementation Plan

> **For agentic workers:** use the design and bounded task briefs; implement on the new branch, review each patch, and preserve a progress ledger.

**Goal:** melhorar desempenho, segurança e jornadas do jogo com evidência comparável, em novo PR.

**Architecture:** preservar TanStack/React/R3F e autoridade servidor/DB; otimizar kernels puros e imports, corrigir trust boundaries e instrumentação antes de afirmar resultados.

**Tech Stack:** Node 24.22.x, TypeScript, React, Three/R3F, Rust/WASM, Supabase/Postgres, Cloudflare, Resend.

**Spec:** `docs/superpowers/specs/2026-11-08-jogomanager-upgrade-design.md`

## Global Constraints

- Lint zero errors e zero warnings; TypeScript sem erros.
- Lighthouse mobile ≥0,97; TBT ≤200 ms; LCP ≤2.500 ms; CLS ≤0,1; a11y ≥0,90; cinco rotas, três runs, agregação pessimista.
- Crescimento startup gzip/Brotli ≤2.048 bytes por rota/métrica; agregado JS ≤400.000 bytes; tetos absolutos mantidos.
- Não alterar fixtures, sementes, presets, ordem RNG ou severidade de gates para produzir aprovação.
- Sem conta/billing/dispositivos novos, dados de outros clientes, force-push, deploy ou merge implícitos.
- Qualquer teste não executado ou comparação não equivalente deve ser identificado como tal.

## Review Focus

- Pausa >250 ms em aba visível deve entrar nas métricas; retomar aba oculta não contamina a campanha.
- Reenviar comando/mensagem/webhook não duplica efeito; a identidade vem do servidor.
- Cache expirado ou de outra conta não autoriza nem sobrescreve progressão.
- Falha do broker OAuth não deve desativar verificação JWT ou inventar conta equivalente em outro projeto.
- Kernel otimizado preserva buffers, topologia, UVs, caps, seeds e limites inválidos.

## Quinze frentes e registro

As frentes 1–6 são diagnóstico independente. As frentes 7–13 produzem patches limitados por arquivos; 14–15 verificam e revisam. Root integra, mede e abre o PR. Paralelismo restrito a leitura ou arquivos disjuntos; nenhum agente faz reset/checkout/commit sobre trabalho de outro.

### Task 1: Repositório e baseline CI
- [x] Confirmar owner/repo/main/SHA, AGENTS e histórico relevante.
- [x] Identificar o gate falho e preservar limites.
- [ ] Incorporar resultado ao relatório final.

### Task 2: Supabase
- [x] Identificar somente o projeto JogoManager e capturar advisors/estatísticas agregadas.
- [ ] Revisar EXPLAIN sem ANALYZE, privilégios e índices; propor mudança somente com contraprova e rollback.
- [ ] Guardar metadados sem dados pessoais ou segredos.

### Task 3: Segurança
- [x] Threat model e headers públicos com requisições mínimas.
- [ ] Rastrear entradas até efeitos em multiplayer/chat/cache/webhook.
- [ ] Entregar achados classificados e protocolo local ativo com limites.

### Task 4: CodSpeed e renderização
- [x] Inventariar os 16 benchmarks e protocolo já existente.
- [x] Distinguir simulation CPU de FPS/GPU e registrar as duas interpretações de 89%.
- [ ] Medir before/candidate sem trocar workloads ou instrumento.

### Task 5: Visual baseline
- [x] Capturas reais das superfícies públicas.
- [x] Documentar WebGL desativado no navegador público.
- [ ] Registrar bug dos países duplicados na criação de carreira e validar correção.

### Task 6: Integrações
- [x] Conferir inventário real Resend e estado auth/broker/cache.
- [ ] Mapear eventos/chamadores; não confundir template published com automação ligada.
- [ ] Documentar alcance efetivo de Cloudflare/VPS e ações sem cobrança.

### Task 7: FPS e estabilidade
**Files:** `src/game/fps-meter.ts`, novo módulo puro de frame stats e testes; callers existentes permanecem compatíveis.
**Interface:** preservar `fpsMeter.start/stop/reset/subscribe/sample` e `fpsReport`; adicionar métricas sem remover campos.
- [ ] Teste de média por tempo, p50/p95/p99, low1/low0.1, stalls visíveis, ocultação e janela temporal.
- [ ] Corrigir descarte de pausas e janela; evitar shift/splice por frame no hot path.
- [ ] Atualizar relatório exportado e testar compatibilidade.

### Task 8: Kernel e classificação
**Files:** `src/game/rig-section-kernel.ts`, `wasm/crowd-visibility/src/rig_section.rs`, respectivos testes; `src/game/standings.ts` se comprovado seguro.
**Interface:** manter ABI, índices, float32 e cap winding.
- [ ] Paridade contra implementação anterior com diferentes radial/roundness/rings/caps.
- [ ] Hoist trigonometria por lado; eliminar arrays temporários por índice.
- [ ] Medir os mesmos benchmarks antes/depois; executar Rust locked e testes TS.

### Task 9: Multiplayer e chat
**Files:** delimitados após achados de Task 3 em `src/lib/chat.functions.ts`, `src/lib/multiplayer.functions.ts`, `src/game/online/` e migrations forward se necessárias.
- [ ] Escolher falhas demonstradas e escrever regressões de ownership/replay/bounds.
- [ ] Corrigir no ponto servidor; não promover validação cliente a anticheat completo.
- [ ] Testar limites, reenvio, expiração e reconexão aplicáveis.

### Task 10: Cache, persistência e auth
**Files:** `src/lib/public-read-cache.server.ts`, `src/lib/careerStorage.ts`, `src/lib/player-career-store.ts`, `src/pages/auth.tsx` e helpers comprovados.
- [ ] Escolher falhas concretas com regressões de expiração/ownership/erro.
- [ ] Isolar cache privado e auth; reutilizar Supabase direto sem depender de saldo Lovable quando a configuração permitir.
- [ ] Validar logout, falha de persistência e modo explícito legacy.

### Task 11: Sobre, contato e suporte automático
**Files:** `src/pages/sobre.tsx`, `src/pages/contato.tsx`, helpers/server functions de suporte existentes.
- [ ] Adicionar endereço/CPF e contexto do criador exatamente conforme solicitação, sem selo de identidade verificada.
- [ ] Webhook assinado/autenticado com limite e idempotência, sem expor segredo no cliente.
- [ ] Verificar UI desktop/mobile e estados de falha/sucesso do canal real.

### Task 12: Carreira, match engine e visual
**Files:** selecionados a partir das jornadas de Task 5; `src/pages/new.tsx` e helpers de catálogo, engine/scene somente com problema demonstrado.
- [ ] Corrigir países duplicados por identidade canônica preservando catálogo e tradução.
- [ ] Inspecionar contratação/finanças/táticas/IA/cutscenes e implementar bugs ou gargalos demonstráveis com testes de resultado.
- [ ] Preservar renderer único, RNG e orçamento; não declarar salto gráfico sem comparação visual.

### Task 13: Startup e modularização
**Files:** raiz/layout, partida rápida e imports encontrados em trace, sem duplicar CSS.
- [ ] Capturar grafo/build baseline e localizar trabalho pesado no startup.
- [ ] Separar módulo/coordenar lazy loading no ponto de uso com fallback útil.
- [ ] Comparar bundles e navegação; manter rotas e conteúdo SSR.

### Task 14: Verificação e evidências
- [ ] Lint/tipos/testes, Rust/WASM, 200 partidas, build/bundle, contratos gráficos e SQL local conforme ferramentas disponíveis.
- [ ] Capturas before/intermediate/after e vídeo real quando renderização permitir; identificar precisamente limitações.
- [ ] Exercício de abuso em ambiente local com dados sintéticos e limites; poucas sondagens públicas não destrutivas.
- [ ] Tabelas com baseline, candidato, delta absoluto/percentual, unidade, ambiente e validade.

### Task 15: Revisão independente e PR
- [ ] Rever diff e achados das frentes, corrigir falhas materiais, registrar riscos.
- [ ] Criar commits e novo PR via GitHub, sem force-push e sem merge/deploy implícito.
- [ ] Acompanhar checks do SHA final; falhas ou metas não atingidas continuam abertas, nunca descritas como sucesso.
