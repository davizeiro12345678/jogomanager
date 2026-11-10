# Quality Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Corrigir falhas reproduzíveis e melhorar desempenho, estabilidade, segurança, recuperação de acesso e atendimento, com evidências antes/depois e limites de validação explícitos.

**Architecture:** Manter a simulação determinística, um único Canvas e as autoridades de servidor/banco existentes. Distribuir tarefas independentes com propriedade de arquivos e revisão integrada. Medir a base congelada e a candidata no mesmo runtime, sem alterar fixtures ou gates.

**Tech Stack:** TypeScript, TanStack Start/React, Supabase/PostgreSQL, Three/R3F, Rust/WASM, Vitest/Tinybench, Cloudflare Worker.

**Spec:** `docs/superpowers/specs/2026-11-08-quality-update.md`

## Global Constraints

- Lint com zero erros e zero avisos; TypeScript sem erros.
- Nenhum relaxamento de gates, budgets, cenários ou severidades existentes.
- Migrações de aplicação novas são forward-only em Drizzle. Policies Realtime têm a exceção delimitada no AGENTS.md.
- Separar evidência local, microbenchmark, teste sintético, GPU física e estado remoto.
- Não expor credenciais nos relatórios, vídeos, logs, código ou PR.
- Alterações reversíveis e delimitadas; importações existentes continuam válidas ao modularizar.

## Review Focus

- Concorrência entre comandos/finalização online: a assinatura e o replay devem representar uma ordem única.
- Timeout/evicção no cache: conclusão tardia não pode substituir carregamento novo nem deixar recursos presos.
- Erros de OAuth por cancelamento ou conta: não podem acionar troca de provedor ou ocultar falha de MFA.
- Saves antigos/corrompidos: reparação limitada não pode alterar resultados de saves válidos.
- Falha ou replay do webhook de suporte: entrega deve permanecer idempotente e nenhum sucesso deve ser inventado.

---

### Task 1: Base congelada e protocolo de comparação

**Files:** `verification/quality-update-20261108/*`, scripts de benchmark/QA existentes e novo comparador quando necessário.

**Interfaces:** Consome `c20036f` e lockfile; produz JSON de ambiente/fixtures/amostras e matriz de aceitação.

- [x] Verificar PR #125, origin/main, branch isolada e AGENTS; preservar outras alterações.
- [x] Instalar a árvore travada e usar o Node fixado pelo projeto.
- [x] Executar e salvar todos os casos CPU antes de editar as áreas medidas.
- [x] Compilar gráficos baseline e registrar cenas alta/seed/câmera/resolução/DPR; capturar imagens/vídeo. Inclui dois vídeos completos de 6min04s, separados das aferições sem gravação.
- [x] Classificar renderer e GPU para não tratar software rendering como certificação física.

### Task 2: CPU, geometria Rust/WASM e estabilidade 3D

**Files:** `src/game/benchmarks/*`, módulos de rig seccionado em `src/game/*`, `wasm/crowd-visibility/*`, renderer e testes focados conforme investigação.

**Interfaces:** Preserva entradas/saídas e propriedade de buffers; entrega a mesma geometria e o mesmo estado determinístico.

- [x] Adicionar regressão de paridade, buffers independentes e casos extremos antes da otimização de trigonometria repetida.
- [x] Pré-calcular direções radiais e reutilizar cálculo por seção sem reduzir detalhes.
- [x] Executar testes TypeScript e Rust/WASM e comparar todos os benchmarks alternados.
- [x] Perfilar Match 3D/cutscenes e corrigir gargalos comprovados, preservando `HdrSanitize`, alta e budgets.
- [x] Registrar média, lows, percentis, stalls e limites ainda não atingidos; nunca concluir 60 FPS por dedução de microbenchmark.

### Task 3: Multiplayer, moderação e migrações

**Files:** `src/game/online/authoritative-match-session.ts`, testes, `src/lib/moderation*`, `drizzle/migrations/meta/_journal.json`, migrações forward necessárias.

**Interfaces:** Mantém contratos de comandos, assinatura e resultado; autorização efetiva permanece no servidor.

- [x] Reproduzir corrida entre hash/aceite/finalização com promessas controladas.
- [x] Serializar mutações relevantes e selar estado antes da finalização; limitar estado de tentativas inválidas.
- [x] Testar evasão Unicode/zero-width e palavras legítimas; normalizar e usar limites de palavras apropriados.
- [x] Corrigir entrada ausente 0061 no journal e garantir que migrações de aplicação pertençam ao fluxo canônico.
- [x] Revisar advisors Supabase e IndexedDB; implementar apenas defeitos demonstráveis e registrar achados não confirmados.
- [x] Executar testes focados e preparar teste ativo local com limites/abort sem tráfego de carga em produção.

### Task 4: Carreira, escalação, contratação, finanças e táticas

**Files:** Módulos `src/game/career-*`, finanças/mercado/lineup e testes correspondentes.

**Interfaces:** Entradas válidas e RNG preservados; valores inválidos são rejeitados ou reparados apenas na fronteira apropriada.

- [x] Testar formação herdada (`constructor`, `toString`), campos não finitos e banco inválido/duplicado.
- [x] Normalizar táticas na recuperação e usar lookup seguro de formações.
- [x] Limitar loops de scouting/mercado e validar propostas/identificadores antes de mutações.
- [x] Corrigir arredondamento salarial em empréstimos usando a política monetária canônica.
- [x] Rejeitar prêmios inválidos antes de consumir a chave idempotente.
- [x] Executar regressões e confirmar fixtures/replays válidos inalterados.

### Task 5: Recuperação de autenticação e cache público

**Files:** Novo módulo OAuth separado, `src/pages/auth.tsx`, testes, `docs/auth-methods.md`, `src/lib/public-read-cache.server.ts` e teste.

**Interfaces:** OAuth usa somente `supabase` existente; helper retorna resultado e rota usada sem expor tokens. Cache continua `get(key, load): Promise<T>`.

- [x] Testar falha transitória do broker, provedor direto explicitamente permitido, cancelamento e credenciais inválidas.
- [x] Implementar fallback limitado ao mesmo projeto e comunicar recuperação por email quando necessário.
- [x] Documentar configuração de credenciais diretas e diferença entre bypass do broker e independência de infraestrutura Auth.
- [x] Testar carregamento pendente que nunca termina e conclusão tardia após timeout.
- [x] Adicionar prazo máximo e liberação segura do cache, mantendo coalescência e isolamento de dados privados.

### Task 6: Suporte, identidade pública e mensagens transacionais

**Files:** `src/pages/contato.tsx`, `src/pages/criador.tsx`, `src/content/creator.ts`, módulo/formulário de suporte lazy, handler e migração quando necessários, integração de emails existente.

**Interfaces:** Formulário autenticado envia assunto/categoria/descrição limitados e chave de solicitação. Webhook recebe evento assinado e ID estável; indisponibilidade externa é reportada corretamente.

- [x] Adicionar detalhes do responsável expressamente fornecidos no pedido, sem afirmar certificação independente.
- [x] Modularizar formulário de suporte para carregar sob demanda; preservar render público inicial.
- [x] Validar schema, autenticação e limites/idempotência duráveis antes da entrega do webhook; testar falsificação, repetição e falha externa.
- [x] Inventariar aliases Resend e gatilhos existentes: 41 templates já publicados, sem drafts. Ativação de novos eventos não foi inferida nem foram enviados emails reais.
- [x] Documentar configuração externa pendente e manter canais atuais acessíveis.

### Task 7: Validação integrada, evidências e entrega

**Files:** Relatório final e artefatos em `verification/quality-update-20261108/`; documentação da atualização.

- [x] Lint zero warnings; TypeScript; testes relevantes, Rust/WASM e build.
- [x] Verificar budgets absolutos, contratos gráficos e testes de segurança/migrações.
- [x] Executar matriz comparável antes/intermediário/final; salvar dados brutos, tabelas de deltas e captures identificados.
- [x] Revisão independente da branch e correção dos achados confirmados.
- [x] Commit com escopo e evidência reais; publicar na branch/novo PR conforme destino estabelecido pelo usuário, sem alterar PR mesclado nem fazer merge.
- [x] Relatar metas alcançadas e lacunas com evidência exata; nenhuma lacuna de FPS/CI/cloud é tratada como aprovada.

## Status e decisões

- 2026-11-08: usuário já autorizou plano seguido de implementação e subagentes; planejamento não interrompe execução.
- 2026-11-08: PR #125 fechado/mesclado; nova branch local preparada. Destino remoto solicitado de forma assíncrona.
- 2026-11-08: SentinelX sem integração registrada e Lovable API indisponível; não simular alterações remotas.
- 2026-11-08: 41 templates Resend publicados, nenhum draft observado; verificar automação por evento separadamente.

- Checkpoint: 2.159 testes gerais aprovados; lint zero; TypeScript aprovado; 18 testes adicionais IBL aprovados. Campanha CPU dos 16 casos preserva três protocolos, incluindo regressões; meta global +89% não atingida. Gate oficial construtor aprovado com +7,979% de tempo CPU. Candidata intermediária 85,463 FPS, média alta atendida somente nesse par RTX; nova execução final em andamento. Migrações e webhook ainda não ativados remotamente.

## Metas do pedido que continuam abertas

A implementação acima não concede aprovação às metas abaixo. Elas permanecem explícitas para que uma melhoria local não seja apresentada como atualização de todos os sistemas.

### Task 8: Match engine e IA com regras versionadas

- [ ] Versionar novas regras de decisão no contrato de partida/ticket/replay; preservar leitura e replay das regras anteriores.
- [ ] Corrigir a condição de armadilha de impedimento atualmente inalcançável para pressing válido 0..2 em uma nova versão de regras, com cenários de linha defensiva, passe em profundidade e impedimento.
- [ ] Medir decisões com cenários determinísticos de apoio, cobertura, pressão coordenada, ocupação de espaço e transição; validar taxas de passe/chute/posse, erros e duelos por função.
- [ ] Integrar comandos autoritativos reais ao transporte de produção; a classe AuthoritativeMatchSession isolada não equivale a essa integração.
- [ ] Reexecutar replays, 200 seeds com replay independente, compatibilidade de saves/tickets e comparações de CPU sem remover gates existentes.

### Task 9: Novos recursos visuais e campanha física completa

- [ ] Produzir/revisar novos materiais e assets de estádio, pitch, torcida e clima com proveniência/licença e memória/triângulos/draws medidos. As otimizações desta entrega preservam os parâmetros visuais e não constituem novos assets.
- [ ] Cumprir três repetições comparáveis por revisão nas GPUs integrada e dedicada, incluindo mudanças de câmera, gols/replays e cutscenes completas da carreira.
- [ ] Reduzir o custo de criação/compilação de rigs e de abertura/reabertura de cinema com perfil de CPU/GPU; manter os stalls na distribuição.
- [ ] Verificar meta de média 60 FPS e stretch de 1% low 50 FPS, sem reduzir alta, resolução ou LOD para alterar a comparação.
- [ ] Completar os 16 casos com CodSpeed instrumentado e preservar regressões/intervalos; a meta global +89% não está comprovada pelos resultados locais.

### Task 10: Ativação e validação dos serviços externos

- [ ] Configurar URL pública HTTPS, segredo HMAC e agendador do receiver de suporte; executar entrega/retry/idempotência de ponta a ponta com fixture aprovada, sem emails pessoais de teste.
- [ ] Aplicar migrações somente após replay canônico Supabase/Postgres e revisão dos índices, grants, RLS e contenção com múltiplas conexões.
- [ ] Validar credenciais OAuth próprias e callbacks diretos no mesmo projeto. Um segundo projeto Auth exige migração explícita de identidades/issuers e ensaio de recuperação; não trocar URL/key automaticamente após erro.
- [ ] Confirmar gatilhos de negócio dos templates Resend que precisarem de novos eventos. A listagem atual tem 41 publicados e zero drafts; publicação não prova automação de todos os eventos.
- [ ] Revisar configuração remota Cloudflare usando integração da zona efetivamente disponível; não atribuir mudanças de headers de aplicação a regras de CDN não publicadas.
- [ ] Completar CI da revisão exata, Lighthouse móvel pessimista de cinco rotas/três execuções, release gates e verificação de SHA de produção antes de qualquer publicação.

- Entrega de fonte: commit 0a6a04e581571a367cc1c742ead21f984abbbc1b no draft PR #128. Oito workflows aprovados nessa fonte, incluindo 2.203 testes e todos os 12 jobs de Quality gates. A medição física final na RTX 4060 registrou 82,263 FPS; o pior stall aumentou para 800,8 ms. A correção posterior do rótulo mobile e os helpers de captura serão incluídos com a evidência e terão CI no novo head. As tarefas 8–10 permanecem abertas; não há merge, publicação ou certificação de três repetições nas duas GPUs.

## Verificação de continuidade em 10/11/2026

| Frente | Evidência atual | O que falta |
| --- | --- | --- |
| IA e regras | A revisão tática 2 já está presente nas partidas rápidas opt-in e no adaptador canônico, com correção de impedimento. | Levar a versão pelo ticket e pelo replay persistido. Medir os cenários de decisão e compatibilidade do Task 8. |
| Sessão autoritativa | O relógio espera o início efetivo, os eventos preservam o tick de criação e a reconexão respeita o prazo inicial. O retry de assinatura preserva a primeira decisão de encerramento. | Transporte autenticado com proprietário único por sala, renovação de tickets, checkpoints duráveis e recuperação após reinício. |
| Carreira e interface | O PR já inclui durabilidade de saves, finanças, acessibilidade e ajustes de CSS para celular. | Validar jornadas integradas e a interface na revisão combinada, incluindo a relação com o PR #130. |
| Gráficos e desempenho | WebGL2 padrão inicializado sem aguardar a detecção WebGPU. O worker padrão carrega 89.686 bytes após separar a sonda de telemetria, dentro do limite de 90.000. Último benchmark físico documentado: 82,263 FPS médios e 190 frames acima de 50 ms. | Medir primeiro frame e stalls na revisão atual. Completar a campanha nas duas GPUs, o inventário de novos assets e os 16 casos CPU. |
| Firebase | O gateway já tinha concorrência e timeout limitados. A remoção de tokens inválidos agora exige a mesma inscrição e versão observadas no envio. | Homologar inscrição, logout e entrega com um dispositivo de teste no projeto Firebase correto. |
| API-Football | A função de produção está na versão 25. A revisão incorpora o limitador de saída da main, com a migração 0066 no journal e no replay de CI. | Medir throughput sustentado e deferrals antes de alterar a cadência. A migração equivalente de 48 concessões já consta no histórico gerenciado. |
| Supabase e serviços externos | PostgreSQL 17.11.0.018 saudável. Migrações 0063–0065 registradas em produção. | Validar receiver HTTPS, segredo HMAC, agendamento, callbacks OAuth com conta de teste e gatilhos Resend. |
| Publicação | O PR permanece em rascunho. A consulta de produção a `/api/health` retornou 503, sem SHA e com auth, credenciais de servidor e banco indisponíveis para o Worker. | Investigar a configuração do Worker de produção. Executar Quality gates e Lighthouse no commit publicado. Confirmar o SHA em `/api/health` quando houver uma release aprovada. |
