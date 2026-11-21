# PR #132 — Plano de expansão multiplayer, confiança, IA, gráficos e física (2026-11-11)

## Continuação ativa de 12/11/2026

Ver [adendo do grande upgrade Match 3D](2026-11-12-match3d-major-upgrade.md), [spec](../specs/2026-11-12-match3d-major-upgrade-design.md) e [ledger verificável](../../../verification/pr132-upgrade-20261112/progress.md). Ele amplia P0/P1/P6/P7/P8, carregamento/cutscenes e SEO/Semrush, preservando o trabalho de multiplayer/moderação. O código atual já contém física de contato v2 e IA tática v2; os diagnósticos e checkboxes iniciais abaixo descrevem a cronologia, não uma lista de bugs que ainda devem ser reaplicados. Somente a evidência atual permite promover um item parcial a entregue.

> **Estado inicial:** plano aprovado pelo pedido do proprietário; **não** equivale a funcionalidade entregue. Este documento amplia, sem substituir, `2026-11-11-jogomanager-release-integration.md`. A PR permanece Draft até os gates. Qualquer benchmark precisa citar dispositivo, SHA, configuração, dados crus e baseline.

## 0. Integração responsável e fronteiras

- Repositório: `davizeiro12345678/jogomanager`; branch existente `integration/release-2026-11-11`, PR #132; base `main`. Não abrir PR concorrente, não reaplicar #127–#131, não reverter alterações de terceiros.
- **Verificar antes de cada fase:** SHA atual, PRs incorporadas, migrations 0066–0071 já existentes, contratos de autoritariedade, regras de replay, workers, qualidade, perfis gráficos, RLS e suporte/outbox. Anexar testes e telemetria às evidências.
- **NUNCA:** assumir pontuação FPS, proteção anti-cheat completa, tolerância zero de fraude, ausência de falso positivo ou infraestrutura confiável sem teste. Não rodar ataque em produção nem ativar o VPS anteriormente comprometido.
- **Compatibilidade:** jogos/saves/replays antigos usam regras/contratos imutáveis. Mudanças de semântica de física/IA devem ser explicitamente versionadas e opt-in, com paridade cliente/servidor e downgrade de apresentação. O servidor decide posse, gols, duração, resultados, economia e recompensas; o cliente só envia comandos autorizados.
- **Release:** feature flags separadas para modos, anticheat experimental, render novo e física opt-in; kill switches testados. Rollback de SQL e deploy, sem apagar tickets ou dados de auditoria.

## 1. Diagnóstico em código confirmado (não apenas sugestões)

| Subsistema | Evidência no código | Risco/ação |
|---|---|---|
| Captura da bola solta | `src/game/sim.ts`: resgate após `looseTime > 3.5` faz `closest.x/z = ball.x/z`, independentemente da distância. | **Teleporte real de atleta**. Eliminar na nova revisão: perseguição por movimentação contínua até contato fisicamente alcançável. |
| Dividida | `src/game/sim-ball-duels.ts` permite conquista se rival está até 2,2 m e troca `ball.holder` instantaneamente, sem garantir autoridade física sincronizada. | Ganho à distância e salto de bola. Exigir contato relativo, alcance, ângulo e velocidade, sincronização Rapier e transferência conservativa. |
| Goleiro/rebote | `sim-ball-duels.ts` reposiciona `gk.x/z` durante defesa. | Salto visual na defesa. Nova revisão deverá manter posição, usar animação/movimento contínuo e rebote a partir da posição real do contato. |
| Contato entre corpos | `sim.ts` separa sobreposições corrigindo todo o overlap em um frame. | Picos de deslocamento e jitter. Resolver penetração gradualmente, limitada por step e massa, sem atravessar postes. |
| Física da bola | `sim.ts`, `rapier-ball-authority`, `match-physics-extras` são duas rotas compat/autoridade. | Comparar impulses, gravidade, bounce, drag, atrito, first touch, efeitos, foot locking e paridade de resultado com a mesma revisão. |
| Multiplayer real | `src/features/multiplayer/LiveRoom.tsx` roda simulação visual local; `src/game/online/canonical-authoritative-engine.server.ts` expõe motor autoritativo separado que não constitui transporte por si só. | Não afirmar partidas autoritativas conectadas em produção sem Durable Object/WS + tickets + checkpoints integrados. |
| Chat/moderação | `src/lib/chat.functions.ts`, `src/lib/moderation.ts`, RPC `admit_room_chat_message` já fazem bloqueio, idempotência e admissão. | Reusar filtros e RPC; evitar escrever pipeline de infração duplicado ou punições automáticas cegas. |

## 2. Etapa P0: fotografia, contratos e testes de regressão

- [ ] Inventariar todas as rotas de lobby/sala/partida/financiamento, Durable Objects, permissões Supabase, RPC e eventos Realtime, incluindo conexões anônimas.
- [ ] Exportar somente **indicadores não pessoais** e versões: tempo de primeiro frame, frametimes p50/p95/p99, FPS 1% low, input→ACK p50/p95, jitter RTT, reconexões, disputas, recapturas gráficas, incidentes de moderação, tickets.
- [ ] Testes RED de teleporte: dominar bola sem estar perto; disputar com adversário a 2,2m; captura após 3,5s; goleiro em defesa; pós-colisão, substituição, escanteio e replay.
- [ ] Separar efeitos **legítimos de reinício** (kickoff, lateral, falta) de movimento contínuo; instrumentar `teleport_explained` e `teleport_unexplained` com amostras anônimas e contagem por 10.000 ticks.
- [ ] Conservar fixtures para regras v1/v2, seeds, checkpoint, worker, TS/WASM e Rapier; validar ambos backends sem novos sorteios desnecessários.

## 3. Etapa P1: nova física/contato sem teleporte

- [ ] Contrato `contactPhysicsRevision` opt-in versionado. Versões anteriores preservam byte a byte/replay. Registrar revisão nos snapshots/checkpoints, worker e sessão autoritativa.
- [ ] **Controle real:** raio de alcance dependente da altura da bola e da animação, relativo à posição da perna/cabeça; rejeitar domínio à distância, impedimento continua decidido no contato.
- [ ] **Recuperação de bola solta:** perseguidores aceleram e freiam, interceptam trajetória; sem escrever posição do jogador como posição da bola. Softlock só dispara fallback validado de árbitro/reposição, nunca teleportar atletas.
- [ ] **Divididas:** contacto mínimo, cone frontal, velocidade relativa, força, equilíbrio, massa, fadiga, slide vs. disputa ombro a ombro; bola pode escapar sem dono, com impulso proporcional à colisão.
- [ ] **Separação:** correção de penetração limitada por substep, impulse/damping; agentes com foot locking durante tackle; proteção contra vibração e atravessar postes.
- [ ] **Goleiro:** plonge/contact solver sem alterar `x/z` instantaneamente no meio do lance; rebote conserva direção, energia limitada, altura e spin.
- [ ] **Bola/gramado:** rolamento e coeficiente de restituição por clima/velocidade, spin, vento, drag, backspin, passes, chutes, cabeceios, pênaltis e carrinhos sem duplo integrador.
- [ ] **Paridade:** rodar 1.000+ seeds, 100 cenários de colisão e 1.000 recuperações de checkpoint; resultados idênticos por seed/revisão/backend determinístico onde aplicável.
- [ ] **Gates:** 0 aquisições sem contato válido em testes direcionados; 0 teleportes inexplicados acima de limite deslocamento por step em 10.000 ticks controlados; não piorar softlocks e resultado de impedimento.

## 4. Etapa P2: transporte multiplayer realmente autoritativo

- [ ] Inventariar/adaptar `match-protocol`, `authoritative-match-session`, `canonical-authoritative-engine.server`, tickets de sala e RPC. O motor de servidor **não é** prova de multiplayer online pronto.
- [ ] **Sala:** ciclo `created→ready→locked→playing→settling→done`, versionamento, lock do roster/seed privado, deduplicação de criação e ownership, concorrência entre duas abas e limite de salas por usuário.
- [ ] **Transporte:** Cloudflare Durable Objects por roomId + WebSocket autenticado por ticket efêmero assinado, nonce/expiração, revalidação de participação, TLS, revogação, backpressure, heartbeats e respostas estruturadas. Token do Supabase não pode ir em URL ou log.
- [ ] **Comandos:** seq monotônico por assento, tick alvo, hash de payload, janela de replay, rate/size budgets, `ack/nack`, retransmissão idempotente, estado de aceitação versionado.
- [ ] **Snapshots:** tick/epoch/checksum autoritativos, snapshots delta + completos periódicos, buffers limitados, reconciliação sem rollback infinito, resync ao reconectar, pacing/render interpolation.
- [ ] **Encerramento:** commit serializado pelo servidor; resultados financeiros, placar e ranking apenas por settlement assinado/idempotente; corridas entre `forfeit`, `finish`, disconnect e expiração têm vencedor único.
- [ ] **Resiliência:** dois dispositivos, duas abas, 3G/4G com jitter, desconexão > lease, failover e deploy do Durable Object; testar condições 0/50/100/200ms RTT e 0/1/5% perdas.
- [ ] **Metas de homologação, não promessas:** p95 ACK de ação < 200ms em infraestrutura/região alvo sem perda; 99,9% de salas finalizam uma única vez sob carga homologada; tolerância zero a placar enviado pelo cliente.

## 5. Etapa P3: modos multiplayer ampliados sem inventar capacidades

- [ ] **1×1 casual**: partida entre dois treinadores, lobby público/privado, convite, senha opcional, seleção de regras/tempo/clubes, espectador limitado.
- [ ] **1×1 ranqueado**: MMR por região/plataforma e desempenho, fila justa com expansão progressiva de faixa, anti-abuso de abandono, temporada/divisões e desempate determinístico.
- [ ] **Amistoso com amigos**: rematch idempotente, convite expirável, bloqueios, privacidade e status.
- [ ] **Torneios e copas**: chaves e tabela persistidas, resultados assinados, bye, double-submit e replay administrativo sem editar placar.
- [ ] **Cooperativo 2×2 (posterior)**: dois treinadores compartilham time com permissões para escalação/táticas, dono da decisão por comando, controle de conflitos e voto/capitão.
- [ ] **Assíncrono e espectador**: replay verificado e turnos declarativos; delay anti-stream-sniping, limites de espectadores e ocultação de seed.
- [ ] 11×11 controlado por jogadores é **outro produto/motor**; não prometer nesse PR sem input realtime por atleta, latência e orçamento validados.

## 6. Etapa P4: anticheat, antiexploit e confiança por padrão

- [ ] **Threat model STRIDE** de salas, matchmaking, ranking, RPC, tickets, OAuth, caches, recompensas e reportes. Registrar vetores e mitigação, não apenas bibliotecas.
- [ ] Nenhuma decisão do cliente sobre score, seed, relógio, RNG, posse, prêmio, ELO, fim da partida ou identidade. Schemas `strict`, limites por tamanho, sequência, tick, seat e epoch.
- [ ] HMAC com chave rotacionável, curta validade e nonce único; detecção de replay e troca de sala/assento. Nunca incluir segredos em logs ou bundles.
- [ ] Rate limit **por usuário, IP e sala** com budgets por ação, Redis/DO local se disponível; absorção de floods sem negar serviço a usuário honesto (backpressure).
- [ ] Testes maliciosos de propriedades: spoof de assento, ordem incorreta, comando pós-encerramento, double spend, colisão de idempotency key, payload gigante, jogo acelerado, 100 clientes concorrentes e bypass da UI.
- [ ] Trilha antifraude minimizada: indicadores de anomalia verificáveis (tempo impossível, resultados inconsistentes, adversários repetidos), score de risco explicável, revisão humana e processo de recurso. Não banir por latência/fps ou detecção estatística isolada.
- [ ] Segurança da conta: 2FA/passkeys opcionais, detecção de troca de sessão, RLS policy por tabela, mínimos privilégios, SAST/DAST em staging; pentest apenas autorizado.
- [ ] Proteção infantil/LGPD: minimização de dados, prazos e exclusão definidos, consentimento e recursos de denúncia acessíveis; sem coleta de drivers/processos pessoais, sem anticheat intrusivo de kernel.

## 7. Etapa P5: chat, moderação e suporte verdadeiramente operacionais

- [ ] **Reusar** `moderation.ts`, `chat.functions.ts`, `admit_room_chat_message`, fingerprint/retry, `support.server.ts` e outbox já presentes. Consolidar infractions, não criar duas fontes de verdade.
- [ ] Chat por sala, DM opcional com consentimento, silenciar/bloquear, canais de sistema, placeholders de tradução e acessibilidade; nunca publicar chat de sala em canal público.
- [ ] Filtros multilíngues contextuais: spam, divulgação de contatos, phishing, hate, assédio, confusables, links encurtados e variações de Unicode. Calibrar falsos positivos em nomes de jogadores/países e vocabulário futebolístico.
- [ ] **Moderação automática em camadas:** validação síncrona determinística na RPC; classificador/IA apenas assinala casos incertos para revisão, com janela de confiança, versão de modelo e sem vazamento de texto privado para serviços externos sem base legal.
- [ ] Infrações com contagem transacional e punição proporcional: aviso→slow mode→mute temporário→revisão humana para suspensão grave. Reincidência não pode ser criada duas vezes por retries. Histórico auditável e recurso.
- [ ] Denúncias de jogadores, conduta, trapaça e falha técnica, com categoria, ID de sala/evento, evidências mínimas e fila de triagem; tickets idempotentes, prioridade/triagem SLA, anti-spam, resposta por e-mail e status consultável autenticado.
- [ ] **Falha de moderação:** se RPC/classificador indisponível, mensagens ficam bloqueadas/pendentes e jamais passam silenciosamente. Logar contagens sem PII em telemetria; não perder mensagens marcadas para revisão.
- [ ] Teste com 1.000 mensagens normais, 1.000 variantes adversariais, idempotência, abuso de 100 salas, disputas e falsos positivos documentados.

## 8. Etapa P6: salto de inteligência artificial futebolística (sem pay-to-win)

- [ ] **Planejamento hierárquico versionado:** treinador escolhe estilo e mudanças estratégicas a cada janela; setor coordena pressão/cobertura/rotas; atleta decide percepção local, primeiro toque, passe, drible, chute, faltas.
- [ ] Percepção: mapa de ocupação por setores, oclusão/linha de passe, xG/xThreat calibrados, vantagem espacial, tempo até interceptação, cansaço, pé dominante e moral; processamento em Worker/WASM sem bloquear render.
- [ ] IA defensiva: pressing triggers, cercar portador, cobertura do lado contrário, bloqueio de linhas, recomposição, armadilha de impedimento, marcação em bola parada e goleiro sem onisciência.
- [ ] IA ofensiva: third-man runs, sobreposições, desmarcação em profundidade e contra-ataque, temporização do passe, triangulações, escolha de chute/rebote, cruzamentos e controle de risco.
- [ ] Treinador: adaptar estratégia ao adversário sem ler seu seed ou futuro, substituições com fadiga/cartão/lesão, gestão de resultados e torneios; personalidades e instruções explicáveis.
- [ ] Níveis de dificuldade por decisões táticas plausíveis, tempo de reação e erro humano. **Não** aumentar arbitrariamente velocidade/atributos da CPU para fingir inteligência.
- [ ] Benchmark A/B por 1.000 sementes pares e home/away invertidos, adversários de referência e seeds adversariais; avaliar xG, gols, passes progressivos, turnovers, cobertura, variância, custo CPU/tick e ausência de colapso tático.
- [ ] IA de segurança (moderação) separada da IA da partida: sem modelo remoto na autoridade por tick, sem custo variável por ação, sem acesso a segredos ou resultados futuros.

## 9. Etapa P7: interface e gráficos 3D melhorados com orçamento

- [ ] Interface multiplayer responsiva: lobby com fila/código/convite, preparação, reconexão, estado de rede, chat ocultável, acessibilidade keyboard/screen reader, modo daltônico, escala móvel e animações reduzidas.
- [ ] Match 3D: matcaps/PBR calibrados para gramado/uniformes, normais/microdetalhes sob LOD, gradação cinematográfica controlada, iluminação consistente por câmera, torcida instanciada, clima/partículas, pé no solo, blending de tackle/recepção.
- [ ] Reconciliar **presentation-only interpolation** sem alterar sim: snapshots tick-timestamped, damping curto, detecção de descontinuidade legítima (reinício) sem arrastar personagens até outra parte do campo.
- [ ] Reduzir draw calls com batching/instancing, atlas, KTX2, DRACO/Meshopt, LOD dinâmico; shadows budget por qualidade, culling, perf monitor e WebGPU opcional com fallback WebGL2 testado.
- [ ] First-frame: preload seletivo, chunks lazy por cena, evitar shader compilation no thread de UI, limitar recaptura IBL, construir rigs de forma reutilizável sem memory leaks. Medir **latência real**, não só tamanho bundle.
- [ ] Homologar desktop midrange e mobile real com 10 minutos por câmera/clima/qualidade; p95/p99/1% low/stalls, uso VRAM/RAM, efeito térmico, GPU lost/recovered, fallback WebGL2.
- [ ] Alvos de aceitação: qualidade alta com 60 FPS médios e p95 frame-time até 20 ms no hardware homologado; mobile perfil adaptativo sem travar, nenhum aumento crítico de bytes iniciais, nenhum `frame >50ms` novo por compilação/GC pós warmup. Valores são critérios, não evidência.

## 10. Etapa P8: execução, gates, implantação e rollback

- [ ] Abrir mudanças pequenas **na PR #132 existente**, com teste unitário e integração por módulo: P1 física→P2 autoridade→P4 segurança→P5 chat→P3 modos→P6 IA→P7 gráficos. P0 e gates sempre em paralelo.
- [ ] CI: ESLint/Prettier, TypeScript strict, Vitest, migração replay PostgreSQL, teste SQL de RLS/race, build + bundle comparator, CodSpeed, snapshot determinismo, testes de rede/abuso, WebGL smoke e Lighthouse.
- [ ] Rodar 100+ salas e 1000+ comandos com concorrência controlada em staging; 0 placares/recompensas adulterados, 0 finalizações duplicadas, 0 PII em logs, 0 retries multiplicadores, SLO p50/p95/p99 publicado.
- [ ] Validar acesso real com conta de teste autorizada, chat e suporte no navegador, suspensão/recurso, reconexão em dispositivo móvel, física em 3 câmeras e 60 FPS físico sob carga.
- [ ] Auditoria independente do diff e ameaças, histórico de migrations, rollback de DO/feature flag/cache. **Não mesclar ou implantar** antes dos gates exatos e aprovação de release.

### Critérios de aceite mínimos antes de marcar [x]

Uma etapa só pode ser concluída com: caminho do código + SHA, testes que realmente rodaram, resultado bruto reproduzível, dispositivo/região quando relevante, documentação de versão/rollback e revisão independente. Marcar como **[~]** quando só o código estiver presente, como **[ ]** quando for ideia, e como **[x]** apenas com evidência comprovada.

## Progresso desta expansão

- [x] Evidências de bug localizadas em `sim.ts` e `sim-ball-duels.ts` por leitura da branch existente.
- [x] Plano expandido priorizado e conectado à PR #132.
- [x] **Primeiro lote de código sem CI confirmado:** physics opt-in nos contratos/Worker, recuperação de bola sem snap, tackle de alcance corporal + alcance da bola, goleiro sem reposicionamento instantâneo, separação limitada, regressões em `contact-physics-revision.test.ts`.
- [x] **Primeiro lote de IA sem CI confirmado:** `ai-ball-interception.ts` com previsão determinística de chegada/curva, conectado apenas à revisão opt-in, com testes puros em `ai-ball-interception.test.ts`.
- [x] **Primeiro lote de segurança/chat sem CI confirmado:** recusa cross-room antes de conexão na sessão autoritativa; detecção de links e e-mails com letras homoglíficas em `moderation.ts`; testes focados para ambos.
- [ ] Implementação física opt-in completa + todos os testes de paridade (inspecionar commits).
- [ ] Transporte server/DO pronto em staging.
- [ ] Moderação/anticheat end-to-end e suporte.
- [ ] Novos modos, IA tática e gráficos completos.
- [ ] CI exato e teste físico concluídos.

**Regra para handoff:** sempre buscar head atual do PR #132, comparar commits, não duplicar etapas já concluídas, preservar #127–#131 e atualizar o ledger com o que foi realmente executado.


## Checkpoint de implementação adicional — 11/11/2026, PR #132

**Estado dos commits:** esta expansão não está terminada. Os itens abaixo indicam código gravado na branch, **não** gates executados ou aprovação de produção. O estado anterior da PR foi lido no SHA `2bb6bcf5433d14f0d49f84ae0b6015e559cbeb6b`, e deve ser atualizado após este registro.

| Etapa | Estado atual | Implementação concreta | Verificação pendente |
|---|---|---|---|
| P0 baseline | [~] | Diagnóstico de `LiveRoom` visual local, seed privada no servidor e contratos existentes; runbook `docs/operations/multiplayer-physics-rollout-2026-11-11.md` | Arquivos de inventário completos, métricas por hardware e ambiente |
| P1 física | [~] | Revisão opt-in, domínio/desarme de curto alcance, retorno da bola sem teleportar atleta, goleiro com função de alcance, perseguição preditiva e testes focados | 1.000 seeds, pipeline Rapier, balanceamento de gols, foot-locking e evidência visual |
| P2 autoridade | [~] | `authoritative-socket-bridge.server.ts` fornece contrato transportável de ticket, ACK/NACK, frame bounded, heartbeat, pressão de buffer, snapshots somente servidor e testes de transporte isolados | **Não há Durable Object conectado, emissor HMAC e cliente de snapshots em produção**; persistência/failover e tickets de sessão ainda faltam |
| P3 modos | [~] | `matchmaking-policy.ts` implementa política pura casual/ranqueado com tolerância de MMR e região, bloqueios, rematch e testes | Fila transacional, ratings no PostgreSQL, convites, torneio, espectador e cooperativo 2×2 ainda não implementados |
| P4 anticheat | [~] | Rejeição cross-room antes da conexão, política de UUID/limite de pacotes, validação de ticket injetável, limite de comando, CAS de resultado existente e modelo STRIDE no runbook | Verificação HMAC real ligada ao DO, auditoria de settlement, detecção de farm, dados mínimos de revisão, stress staging |
| P5 chat/suporte | [~] | `RoomChat.tsx` reutilizado no lobby e na partida, botão silenciar local, denúncia com ID de sala validado e prefilling de ticket, reuso do outbox autenticado | Fila de moderação humana, recursos, detecção contextual calibrada, denúncias vinculadas a mensagens e validação ponta a ponta |
| P6 IA | [~] | `ai-ball-interception.ts` prediz alvo e penaliza mudanças bruscas de direção na revisão opt-in | IA hierárquica de todo time, planejador ofensivo e defensivo, benchmark A/B |
| P7 UI/3D | [~] | Chat acessível durante partida, botão de qualidade alta/média/baixa e aviso transparente de prévia local | Novos materiais/rigs, interpolação de snapshots de servidor, testes FPS físicos, deformação de malha e iluminação |
| P8 release | [ ] | Novo SQL 0072, tipos/manifesto e teste SQL de trigger; checklist de staging documentado; CI de GitHub disparado | **Ainda não aprovado**: Quality Gates/Prettier/TypeScript/Vitest, staging, testes de dispositivos, ruleset admin e release |

### Critérios operacionais da migration 0072

- A migration `0072_match_contact_physics_revision.sql` registra revisão 1 para salas existentes e a revisão 2 para futuras salas, com `CHECK` e bloqueio de alteração direta por usuários comuns.
- O replay servidor em `multiplayer.functions.ts` escolhe a revisão da linha persistida; para modelo 2, não invoca o worker auxiliar antigo sem contrato de paridade.
- `LiveRoom.tsx` usa a revisão persistida para evitar simulação de modelo 2 em sala legada.
- `tests/sql/match_contact_revision_contract.sql` e `scripts/verify-local-database.mjs` agora incluem verificação do esquema e proibição de atualização pela role `authenticated`; **o teste não foi executado localmente e a migration não foi aplicada em produção**.
- Sem assinatura/ticket válido, não conectar WebSocket. O bridge de servidor é uma unidade de código para integração, e não uma rota Cloudflare publicada.
- A interação com suporte não obtém automaticamente conteúdo de mensagens: o usuário abre o relato contextualizado e descreve a ocorrência sem publicar PII de terceiros.

### Bloqueadores restantes

- Não foi disponibilizado runtime npm/Node ou PostgreSQL isolado que pudesse executar a branch por este conector; não declarar testes verdes sem prova de CI.
- Actions de todos os novos SHAs observados estavam `queued`; um novo commit reinicia os gates exatos.
- Não há evidência de GPU física nem sincronização oficial do multiplayer entre navegadores.
- A integração GitHub não possui permissão de alterar proteção da `main`; segurança de host VPS, operação de índices PostgreSQL e deploy Cloudflare exigem seus próprios gates.
- Preservar PR #132 como Draft, não publicar alteração 0072 antes de validar commits e rollback.

**Prioridade de continuação técnica:** resolver primeiro qualquer erro do CI exato; integrar Durable Object + tickets reais + snapshots de cliente em staging; depois fila transacional ranqueada, anticheat end-to-end, IA hierárquica e perfil gráfico, sempre com teste e rollback. Nenhuma dessas entregas futuras deve ser declarada concluída por existir apenas no plano.
