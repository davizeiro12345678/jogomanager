# Pro Football Manager 3D

**Site oficial e endereço canônico:** https://jogomanager.com

**Futebol. Decisões. Histórias. Seu clube, sua trajetória.**

[![Quality gates](https://github.com/davizeiro12345678/jogomanager/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/davizeiro12345678/jogomanager/actions/workflows/quality.yml)
[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://app.codspeed.io/davizeiro12345678/jogomanager)
[![Segurança](https://img.shields.io/badge/seguran%C3%A7a-divulga%C3%A7%C3%A3o%20respons%C3%A1vel-26705a)](SECURITY.md)
[![Plataforma](https://img.shields.io/badge/plataforma-navegador%20%7C%20PWA-226a90)](https://jogomanager.com)

O **Pro Football Manager 3D (jogomanager)** é um jogo brasileiro independente de gestão de futebol para navegador: você escolhe um clube, organiza o elenco, monta estratégias, acompanha a evolução de uma carreira e vê suas decisões se transformarem em partidas com apresentação tridimensional. Também há caminhos próprios para carreira de jogador, partida rápida e experiências online, conforme a versão e a disponibilidade do ambiente.

**[Jogar](https://jogomanager.com)** · **[Começar uma carreira](https://jogomanager.com/carreiras)** · **[Partida rápida](https://jogomanager.com/partida-rapida)** · **[Carreira de jogador](https://jogomanager.com/carreira-jogador)** · **[Guia do jogo](https://jogomanager.com/guias)** · **[Política de segurança](SECURITY.md)**

> **Nota de transparência (21/11/2026):** a presença de uma funcionalidade no código não confirma que ela esteja liberada, homologada ou disponível no domínio público. A branch principal, o PR de integração e o deploy podem estar em revisões diferentes. Os badges mostram o estado reportado pelas respectivas ferramentas, não uma certificação de segurança, FPS ou desempenho físico.

## Navegação deste repositório

1. [O que é possível fazer no jogo](#experiência-do-jogador)
2. [Percurso completo do jogador](#percurso-do-jogador--do-primeiro-acesso-à-partida)
3. [Jornada e evolução do projeto](#evolução-do-projeto--marcos-verificáveis)
4. [Arquitetura e fluxo de dados](#arquitetura-técnica-e-fluxo-de-dados)
5. [Estrutura do código](#mapa-do-repositório)
6. [Desenvolvimento local](#desenvolvimento-local)
7. [Testes, performance e qualidade](#testes-performance-e-critérios-de-aceite)
8. [Entrega e operação](#caminho-de-uma-alteração-até-o-site)
9. [Segurança](#segurança-por-camada)
10. [Estado atual, contribuições e documentação](#estado-de-entrega-e-pendências)

## Experiência do jogador

| Caminho | O que entrega | Entrada |
| --- | --- | --- |
| **Carreira de treinador** | Administração do clube, contratações, elenco, finanças, treino, calendário, táticas e progressão de temporadas | [Carreiras](https://jogomanager.com/carreiras) |
| **Carreira de jogador** | Construção de um atleta, posição, treinos, oportunidades e evolução individual | [Carreira de jogador](https://jogomanager.com/carreira-jogador) |
| **Partida rápida** | Preparação de um confronto para conhecer o motor, as câmeras e a apresentação 3D | [Partida rápida](https://jogomanager.com/partida-rapida) |
| **Multiplayer** | Salas, desafio entre treinadores e fluxos autoritativos conforme o ambiente homologado | [Multiplayer](https://jogomanager.com/multiplayer) |
| **Conteúdo e consulta** | Tabelas, guias, scouting, formações e explicações de regras | [Guias](https://jogomanager.com/guias) |
| **Criação e personalização** | Criação de clube, atleta e ajustes visuais, dentro das opções expostas pela versão | [Criador](https://jogomanager.com/criador) |

A base do produto é **tomada de decisão**, não controle arcade do atleta. Em partidas, o objetivo é conectar formação, instruções, condição física, comportamento dos jogadores e desfechos simulados. Os dados de clubes e ligas podem ter escopos diferentes entre catálogo informativo, competições publicadas e clubes selecionáveis; não presuma que todo registro importado seja jogável.

### Percurso do jogador — do primeiro acesso à partida

~~~mermaid
flowchart TD
  A["jogomanager.com — entrada pública"] --> B{"Como jogar?"}
  B --> C["Carreira de treinador"]
  B --> D["Carreira de jogador"]
  B --> E["Partida rápida"]
  B --> F["Multiplayer, se disponível"]
  C --> G["Clube, elenco, tática, finanças"]
  D --> H["Atleta, posição, treino e carreira"]
  E --> I["Escalações e preparação"]
  F --> J["Sala, identidade e autorização"]
  G --> K["Simulação e apresentação 3D"]
  H --> K
  I --> K
  J --> L["Motor autoritativo no servidor"]
  K --> M["Resultado, histórico e próxima decisão"]
  L --> M
  M --> N{"Persistência"}
  N --> O["Save local / offline"]
  N --> P["Sincronização na nuvem, quando autenticado"]
~~~

O primeiro acesso pode ocorrer sem conta. O progresso local pertence ao navegador/dispositivo; a sincronização com a nuvem depende de autenticação e disponibilidade do serviço. Antes de trocar de aparelho, limpar dados ou migrar saves, exporte uma cópia e confira a sincronização. A operação offline não significa que login, pagamentos, importação de dados ou multiplayer também funcionem offline.

## Evolução do projeto — marcos verificáveis

Este é o percurso técnico documentado, não uma lista inventada de datas de lançamento. Os marcos refletem arquivos, commits e relatórios presentes no repositório e devem ser interpretados junto ao SHA e ao ambiente de execução.

| Fase/marco | Evolução e evidência | Observação |
| --- | --- | --- |
| **Base do jogo** | Editor de carreiras, partidas, táticas, calendários e persistência local; módulos em **src/game**, **src/routes** e **src/components** | O histórico do Git registra a evolução detalhada. |
| **Motor e apresentação 3D** | Three.js/R3F, física Rapier, workers de simulação, LOD e controle de qualidade gráfica | Certificação em aparelhos físicos exige medições próprias. |
| **Outubro de 2026** | Trabalhos documentados sobre Core Web Vitals, segurança de cache e integrações, SSR/SEO, RLS e distribuição | Consultar relatórios de outubro em **docs/**. |
| **03/11/2026** | Estudos de alternativas WASM e pilotos de performance | [Relatório técnico](docs/report-2026-11-03-speed-and-wasm-pilots.md). |
| **06–08/11/2026** | Evolução de UX de carreira, escritório do técnico, cenas, tutoriais, push/chat e ajustes de CI | Evidências e ressalvas em **docs/report-2026-11-06-*.md** e **roadmap.md**. |
| **13–14/11/2026** | Otimizações incrementais de contadores de lesões e fusão do PR #138 para rotas públicas, SSR e indexação | Ver [PR #138](https://github.com/davizeiro12345678/jogomanager/pull/138) e notas do [PR #132](https://github.com/davizeiro12345678/jogomanager/pull/132); medições de SQL não equivalem a ganhos de tempo de página. |
| **19–21/11/2026** | Homologação de migrações, contratos de multiplayer, segurança, desempenho móvel e publicação concentradas no PR #132 | **Ainda não é release aprovado**. Validar o último SHA, os gates e os ambientes reais antes do merge. |

O desenvolvimento é independente. [Conheça a história e o criador](https://jogomanager.com/criador). Ferramentas de assistência, como Lovable, podem participar da edição, mas **GitHub, testes e autorização de release** são as referências para rastrear alterações. O histórico de commits e PRs é a trilha auditável: [commits](https://github.com/davizeiro12345678/jogomanager/commits/main), [pull requests](https://github.com/davizeiro12345678/jogomanager/pulls) e [Actions](https://github.com/davizeiro12345678/jogomanager/actions).

## Arquitetura técnica e fluxo de dados

| Camada | Implementação / finalidade |
| --- | --- |
| **UI e roteamento** | React 19, TypeScript, TanStack Start/Router/Query/Store, Vite, Zod, CSS e design responsivo. |
| **Simulação de futebol** | Motor TypeScript determinístico, ticks, seeds, contratos de replay e Web Workers; partes auxiliares em Rust/WASM quando comprovadas. |
| **Apresentação de partida** | Three.js, React Three Fiber, Drei, postprocessing, Rapier, BVH, detecção de GPU, LOD e resolução dinâmica. |
| **Dados e autenticação** | Supabase PostgreSQL, RLS, Auth, Realtime e migrações versionadas com Drizzle. |
| **Infraestrutura e rede** | Cloudflare/Workers, endpoints SSR e serviços auxiliares; VPS e integrações externas conforme configuração efetiva. |
| **Comércio** | Stripe com separação de sandbox/produção, validação de webhook e concessão durável no servidor. |
| **Catálogo futebolístico** | Rotinas de ingestão e reconciliação com provedores externos, cotas e validação antes da publicação. |
| **Observabilidade/QA** | GitHub Actions, Vitest, Lighthouse, CodSpeed, métricas de runtime e relatórios reproduzíveis. |

### Do clique ao resultado: fronteiras de confiança

~~~mermaid
flowchart LR
  U["Navegador / PWA"] --> C["Cloudflare: CDN e entrada HTTP"]
  C --> S["Aplicação TanStack / SSR / APIs"]
  U --> W["Renderização 3D / worker de simulação local"]
  S --> A["Supabase Auth"]
  S --> D[("PostgreSQL + RLS")]
  S --> P["Stripe e webhook autenticado"]
  S --> F["Ingestores de futebol"]
  S --> M["Sessão multiplayer no servidor, se habilitada"]
  M --> D
  P --> D
  F --> D
  W --> U
~~~

**Observações de segurança:** o navegador não é autoridade sobre pagamentos, moedas, conquistas persistentes, RLS ou resultado competitivo. Credenciais privilegiadas devem existir apenas em serviços de servidor. Replay local, multiplayer autoritativo e compras têm contratos distintos. Nenhuma tecnologia ou política listada aqui deve ser tratada como efetivamente ativada em produção sem verificação de configuração e tráfego.

### Persistência, simulação e determinismo

- **Save local/PWA:** continuidade no mesmo dispositivo, com cuidados de exportação e sincronização.
- **Save autenticado:** validar posse, progressão e conflitos no servidor; uma cópia local não concede itens ou vitórias.
- **MatchSim:** preservar ordem de cálculos, randomização controlada, snapshots e replays; ganhos de desempenho que mudem o estado da simulação são regressões.
- **3D:** separar evolução visual e física da autoridade de placar, respeitar o orçamento de frame e oferecer fallback para GPUs distintas.
- **Multiplayer:** admitir participantes com ticket, identidade, sala, sequência/ack e autoridade no servidor. Não confundir testes de contrato com uma partida real homologada em vários dispositivos.
- **Catálogo:** normalizar identificadores, evitar duplicação e aplicar cotas/backpressure para não comprometer a API nem o banco.

## Mapa do repositório

| Caminho | Responsabilidade |
| --- | --- |
| **src/routes/** | Rotas do site, SSR, APIs, autenticação, modos do jogo e páginas editoriais. |
| **src/game/** | Regras, simulação, IA, física, determinismo, testes e benchmarks. |
| **src/components/** | Componentes React, telas, estádios, atletas e apresentação 3D. |
| **src/lib/** | Bibliotecas de aplicação e lógica compartilhada/servidor. |
| **cloudflare/** | Workers e serviços ligados ao edge. |
| **supabase/** e **drizzle/** | Configuração, migrations, contratos de banco e histórico versionado. |
| **wasm/** | Componentes Rust/WASM e suas validações. |
| **scripts/** | Build, segurança, qualidade, performance, verificação de publicação e manutenção. |
| **tests/** | Contratos e testes complementares, incluindo SQL. |
| **.github/workflows/** | Gates de CI, comparação de performance, segurança e publicação. |
| **docs/**, **verification/** | Arquitetura, runbooks, planos, auditorias e evidências. |

A documentação de arquitetura mais específica está em [docs/architecture/stack-status.md](docs/architecture/stack-status.md) e o contrato de desempenho em [docs/critical-performance.md](docs/critical-performance.md).

## Desenvolvimento local

**Pré-requisitos:** Node.js conforme **.nvmrc** (o pacote exige Node **>=24.22 <25**), npm, Git e, somente para suítes que precisarem, Rust/Cargo e Docker/Supabase CLI. O projeto usa **package-lock.json** para instalação npm reprodutível; a presença de **bun.lock** não autoriza misturar resoluções de dependência na mesma medição.

~~~bash
git clone https://github.com/davizeiro12345678/jogomanager.git
cd jogomanager
nvm use
npm ci
cp .env.example .env
npm run dev
~~~

Preencha **.env** apenas com chaves locais ou de staging. **.env.example** lista nomes e valores públicos ilustrativos: não é um conjunto de credenciais para produção. Se um serviço exigir credenciais privadas, use um cofre/secret store do ambiente e o mecanismo de secrets de sua plataforma. Não commit **.env**, tokens, cookies nem dumps de usuários.

~~~bash
npm run lint
npm exec -- tsc --noEmit --pretty false
npm test
PFM_LOCAL_VERIFY=1 npm run build
npm run test:performance-gates
npm run wasm:test
npm run graphics:build
npm audit --omit=dev --audit-level=high
~~~

Alguns comandos exigem ferramentas, redes ou dependências opcionais não presentes em uma instalação básica. **Não rotule uma etapa pulada como aprovada**. Para visualizar o estúdio gráfico após gerar os assets:

~~~bash
npm run graphics:preview
# Abrir http://127.0.0.1:4193/player-studio.html
~~~

O proxy de prévia deve buscar somente recursos públicos: nunca encaminhe cookies ou cabeçalhos de autorização a um host de assets. O desenvolvimento, a homologação e a produção devem usar bancos, contas, webhooks, domínios e segredos separados.

## Testes, performance e critérios de aceite

A fonte de verdade para os gates é [Quality gates](.github/workflows/quality.yml), junto aos workflows de [CodSpeed](.github/workflows/codspeed.yml), [testes de carreira](.github/workflows/career-regression-tests.yml), [publicação](.github/workflows/cloudflare-production.yml) e segurança.

| Dimensão | Evidência exigida |
| --- | --- |
| **Qualidade de código** | Lint sem avisos, typecheck, testes e build. |
| **Simulação** | Seeds e checkpoints reproduzíveis, replays determinísticos e stress de partidas. |
| **Performance** | Comparar base e candidato no mesmo runner, mesmas fixtures, runtime e ordem controlada; registrar p50/p95/p99 e regressões. |
| **Bundle** | Comparação do custo de startup e contrato de assets, sem esconder trabalho deslocando código para outro caminho. |
| **Gráficos** | Contratos 3D, medições de frame time/tempo de bloqueio e verificação visual; aparelhos reais são evidência separada. |
| **Mobile** | Lighthouse com amostras múltiplas e critérios do [documento de performance](docs/critical-performance.md), não apenas um score isolado. |
| **Banco e segurança** | Replay de migrações em banco descartável, RLS e permissões mínimas, contratos de Edge e verificação de dependências. |
| **Operação** | Homologar OAuth, checkout sandbox/webhook idempotente, multiplayer em vários aparelhos, reversão e restauração. |

Metas como **89% de melhoria no CodSpeed**, **97+ em todas as rotas** ou **60 FPS** são metas, **não resultados automáticos**. Um teste passando em CI não substitui uma compra Stripe de teste ponta a ponta, uma partida real com múltiplos participantes, a restauração de um backup nem a comparação na mesma configuração de hardware.

## Caminho de uma alteração até o site

~~~mermaid
flowchart TD
  A["Issue / hipótese / plano"] --> B["Branch + código + testes"]
  B --> C["Pull request e revisão"]
  C --> D["CI / performance / segurança"]
  D --> E{"Todos os gates e homologação passaram?"}
  E -->|Não| B
  E -->|Sim| F["Aprovação do release"]
  F --> G["Merge protegido na main"]
  G --> H["Quality gates na main"]
  H --> I{"SHA atual + gates válidos?"}
  I -->|Não| J["Bloquear publicação / corrigir"]
  I -->|Sim| K["Workflow de Cloudflare"]
  K --> L["Verificar health / commit / rotas públicas"]
  L --> M["Monitorar, comparar e reverter se necessário"]
~~~

O [workflow de publicação](.github/workflows/cloudflare-production.yml) escuta o sucesso de **Quality gates** em um **push** da **main**, confirma a revisão atual e executa a rotina de deploy quando há credenciais. **Mudar a main pode disparar publicação automática:** nunca fazer merge sem considerar impacto operacional. O deploy, o estado do Worker, a propagação de CDN, o DNS e o conteúdo servido são verificações distintas.

Depois de uma publicação autorizada:

~~~bash
node scripts/verify-public-discovery.mjs --live
~~~

Verifique **/llms.txt**, **/robots.txt**, **/sitemap.xml**, **/api/health** e o SHA efetivamente servido. Quando houver divergência, investigue o estado do deploy antes de invalidar o cache. Não use purga de CDN como substituto de correção de origem.

## Segurança por camada

1. **Repositório:** PR protegido na main, checks obrigatórios, sem force-push nem exclusão; ações com permissões mínimas, revisão de atualizações e trilha de auditoria.
2. **Dependências/código:** alertas e atualizações automatizadas quando habilitados no GitHub, CodeQL/varreduras de CI, auditoria de lockfiles; resultados devem ser triados.
3. **Navegador e borda:** CSP, headers, proteção contra XSS/CSRF conforme rota, HTTPS, WAF/rate limiting e controle de cache privado na configuração efetiva.
4. **Identidade e dados:** Supabase Auth, validação de sessão, RLS, escopos por usuário, operações privilegiadas exclusivamente no backend e backups restauráveis.
5. **Pagamentos:** isolamento de sandbox/live; confirmação por webhook autenticado, idempotência e concessão validada pelo servidor, não pelo retorno do navegador.
6. **Multiplayer e comunidade:** autoridade de sala, antirreplay, rate limiting, prevenção de abuso, restrição de chat e auditoria com dados mínimos.
7. **Operação e incidentes:** segredos em cofres, rotação quando necessário, monitoramento e capacidade testada de recuperação, sem divulgar topologia sensível.

Consulte [SECURITY.md](SECURITY.md) para escopo de suporte, reporte confidencial, práticas de teste seguro e tratamento de incidentes. **Documentação de controle não comprova sua ativação no painel da Cloudflare, GitHub, Stripe, Supabase ou VPS.** O inventário de proteções confirmadas e pendentes está em [auditoria de segurança do repositório (21/11/2026)](docs/security/repository-protections-2026-11-21.md).

## Estado de entrega e pendências

O [PR #132](https://github.com/davizeiro12345678/jogomanager/pull/132) consolida trabalho de arquitetura, autenticação, performance, multiplayer e segurança, mas **permanece em rascunho** enquanto houver homologações operacionais pendentes. Não antecipar disponibilidade de funcionalidades somente porque existem branches ou testes automatizados aprovados.

Prioridades de homologação antes da liberação: verificação de OAuth real, Stripe em sandbox com webhook, multiplayer 1×1 e 2×2 em dispositivos físicos, conectividade/recuperação de infraestrutura, inventário de riscos e verificação de publicação em domínio canônico. O estado mais recente e a lista de bloqueios devem ser conferidos no PR e nos artefatos do **último SHA**, não em screenshots antigos.

## Participação, manutenção e uso

- Para reportar erros comuns ou propor mudanças, use [Issues](https://github.com/davizeiro12345678/jogomanager/issues) sem dados pessoais ou segredos.
- Para falhas de segurança, **não abra issue público com prova de exploração**; leia [SECURITY.md](SECURITY.md).
- Faça mudanças em branch, preserve contratos de simulação e operações, acrescente testes e descreva riscos e plano de reversão.
- Revisões de terceiros e automações ajudam, mas não devem impor aprovações impossíveis ao mantenedor único nem liberar o release com gates vermelhos.
- O repositório é público. **Disponibilidade do código não equivale, por si, a uma licença de reutilização:** verifique as permissões aplicáveis antes de redistribuir código, conteúdo ou assets.

### Leituras complementares

[Design](DESIGN.md) · [Arquitetura](docs/architecture/stack-status.md) · [Performance crítica](docs/critical-performance.md) · [Runbook Cloudflare/Supabase](docs/cloudflare-supabase-deployment.md) · [Pagamentos](docs/payments-configuration.md) · [Autenticação](docs/auth-methods.md) · [Plano e progresso](docs/superpowers/plans/2026-11-11-jogomanager-release-integration.md) · [Política de segurança](SECURITY.md) · [Site oficial](https://jogomanager.com)

---

**Pro Football Manager 3D / jogomanager.com** — desenvolvido de maneira independente. Acompanhe o progresso no [GitHub](https://github.com/davizeiro12345678/jogomanager) e experimente a versão pública em [jogomanager.com](https://jogomanager.com).
