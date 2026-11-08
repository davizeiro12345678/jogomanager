# Índice das 15 auditorias estáticas anteriores — JogoManager

**Fonte:** síntese do workflow de 15 auditorias independentes concluído em 2026-11-07. Este índice preserva o escopo da inspeção: leitura estática do repositório; não converte achados históricos em estado atual, não afirma que testes foram executados e não substitui revisão por SHA. Evidência citada é path/linha ou comportamento visto na revisão original.

**Plano ampliado:** [`mega-update-implementation-plan-2026-11-07.md`](mega-update-implementation-plan-2026-11-07.md) relaciona estas 15 auditorias aos 25 aprofundamentos recentes e aos lotes de implementação.

**Limites comuns:** os relatórios não editaram código nem chamaram serviços; status e configuração de produção, chaves, limites contratuais de API, segurança Cloudflare/DNS, dados atuais de backlinks e banco hospedado não foram inferidos sem fonte autorizada. Achados devem ser revalidados no SHA em que serão corrigidos.

## 1. `career-css-audit` — CSS da carreira

**Status registrado:** concluído; somente leitura; sem testes executados.

Foram revisados os quatro CSS designados e os imports/consumidores necessários para verificar contexto. Principais riscos: o foco visível de h1 pode ser removido por regra incondicional; há estilos repetidos em cascade e o arquivo de shell concentra áreas distintas. Não foram feitas alterações nem chamadas a serviços.

**Evidência registrada:**
- src/components/game/career-interface.css:1-3 agrega career-shell.css, career-screens.css e coach/coach-office.css; o import é usado por GameShell.tsx:66 e QuickLive.tsx:27. src/pages/new.tsx:61 importa separadamente career-create.css.
- src/components/game/career-screens.css:256-260 aplica outline:none a todo h1 focado dentro de .career-content; o seletor da linha 257 não restringe a :not(:focus-visible). O shell permite foco programático do main via tabIndex=-1 em GameShell.tsx:421.
- src/components/game/career-create.css:8-11 define foco visível global para controles, mas career-create.css:312-320 remove outline do input de .career-search com !important; o feedback alternativo em :focus-within (309-311) altera somente a borda.
- src/components/game/career-screens.css:184-188 define hover em linhas de tabela; career-shell.css:2572-2574 repete o mesmo seletor/efeito, com ordem de import fazendo prevalecer a declaração do shell.

**Achados prioritários registrados:**
- Alta — Foco de teclado potencialmente invisível em headings: src/components/game/career-screens.css:257-259 remove outline de h1:focus incondicionalmente. Se um h1 receber foco (inclusive programático com navegação/skip), a regra pode anular o indicador de foco; restrinja a remoção a :not(:focus-visible), como já ocorre para h1/h2 na linha 242, ou mantenha outro indicador inequívoco.
- Média — Foco do campo de busca é apenas borda: src/components/game/career-create.css:316 usa outline:none!important em .career-search input, enquanto :focus-within (309-311) só troca a cor da borda. O foco pode ficar pouco perceptível, sobretudo em temas/contrastes variados; aplicar indicador robusto ao wrapper em :focus-within ou remover a supressão.
- Baixa — Duplicação e ambiguidade de cascade: hover de tabela está definido em career-screens.css:184-188 e repetido em career-shell.css:2572-2574. Manter uma única fonte reduz divergência quando cores/comportamento mudarem.
- Baixa — Modularização e regressão: career-shell.css mistura shell, telas/tabelas, controles de jogo e match numa folha de 2713 linhas; breakpoints e regras de movimento aparecem em blocos separados. Separar por responsabilidade (shell/nav, telas/tabelas, match) e agrupar breakpoints por componente ajudaria a prever precedência; validar visualmente após qualquer refatoração.

**Próximos passos originalmente recomendados:**
- Ajustar a regra de foco de h1 para não suprimir :focus-visible e verificar foco com teclado/tecnologia assistiva.
- Reforçar visualização de foco em .career-search via estilo claro em :focus-within, mantendo contraste suficiente.
- Eliminar o hover duplicado e, se houver mudança maior, modularizar career-shell.css por responsabilidade preservando a ordem deliberada de cascade.
- Fazer validação visual em larguras móveis e desktop, além de prefers-reduced-motion e forced-colors, após mudanças; nenhum teste foi executado nesta auditoria.

## 2. `career-static-audit` — Telas e experiência da carreira (src/routes e src/components/game)

**Status registrado:** concluído — auditoria estática, somente leitura; testes não executados.

As rotas de carreira são enxutas e delegam as telas a módulos dedicados; componentes como CoachWeekPlanner e CoachLeagueTable mostram boa separação e tratamento explícito de busy/erro/vazio. Os riscos mais claros estão em padrões incompletos de acessibilidade para abas/diálogo e em um rótulo ARIA incorreto na tela de objetivos do atleta. Há componentes especializados cuja integração merece confirmação; não foi possível avaliar o conteúdo das páginas em src/pages, fora do escopo definido.

**Evidência registrada:**
- src/routes/carreira.tsx:6-10,34; src/routes/jogador.painel.tsx:1-9,28 — rotas pequenas que encaminham para componentes de página; carreira de treinador usa ssr:false.
- src/components/game/coach/CoachWeekPlanner.tsx:35-105 — seção com estado busy, mensagem de processamento, erro role=alert, estado de clube sem treinador e controles desabilitados durante operação.
- src/components/game/coach/CoachResults.tsx:50-129 — lista resultados e oferece mensagem vazia explícita.
- src/components/game/LeagueStandings.tsx:82-123,133-143,310-315 — busca/filtro, contagem anunciada, tabela com caption e mensagem de nenhum resultado.

**Achados prioritários registrados:**
- P1 — src/components/game/athlete/PlayerObjectives.tsx:25: aria-label={`{finished} de {objectives.length} metas alcançadas`} apresenta chaves literais, não valores dinâmicos; leitor de tela recebe a expressão textual em vez da quantidade efetiva. Corrigir para interpolar as variáveis.
- P2 — src/components/game/MatchReport.tsx:37-43,76-99: o diálogo usa role=dialog/aria-modal manualmente. Não há evidência neste componente de foco inicial, contenção de foco, Escape ou restauração de foco; além disso, o controle com role=tab não está dentro de tablist nem ligado a painéis identificados. Risco de navegação por teclado e tecnologia assistiva; considerar Dialog acessível já disponível no projeto e completar o padrão de abas.
- P2 — src/components/game/CareerWorldPanel.tsx:122-145: as abas não implementam navegação por setas/foco roving (nem tabIndex explícito), apesar do uso de role=tablist/tab. O componente não aparece referenciado nas buscas locais em rotas/componentes; confirmar se está deliberadamente inativo ou se falta integração.
- P3 — src/components/game/CareerWorldPanel.tsx:25-282: concentra dados de identidade, métricas, imprensa, relações, memórias e cena de entrevista em um componente de 282 linhas. Se retomado/ativado, extrair os painéis e encapsular estado de entrevista para reduzir acoplamento e facilitar testes acessíveis.

**Próximos passos originalmente recomendados:**
- Corrigir o aria-label do placar de objetivos e validar a mensagem com leitor de tela.
- Rever MatchReport para usar o componente de diálogo acessível da aplicação e implementar tabs conforme padrão ARIA, incluindo associação e operação por teclado.
- Confirmar a intenção de uso de CareerWorldPanel; se ativo, integrar à página correspondente e modularizar seus painéis.
- Fazer revisão visual/funcional das páginas de carreira em src/pages em uma etapa posterior, pois essas implementações estão fora do escopo desta auditoria.

## 3. `stadium3d-static-audit` — Stadium3D e renderização 3D

**Status registrado:** concluído — leitura estática; nenhum arquivo alterado e nenhum teste executado.

O palco está modularizado em componentes especializados para campo, arquibancadas, clima, torcida, luzes, bola, câmera e efeitos. Stadium3D trata Canvas, seleção de backend e orçamento adaptativo; StadiumScene ainda concentra a orquestração visual e parte da lógica de lances. O batching estático e a recuperação de WebGL têm implementação explícita, mas há risco de congelar meshes animados dentro de StaticBatch e cobertura limitada para lifecycle/performance em runtime.

**Evidência registrada:**
- src/components/game/Stadium3D.tsx:145–178, 201–249 — seleção WebGPU/WebGL2, montagem do Canvas e marcação de prontidão; linhas 106–112 — suspensão quando a página fica oculta; linhas 114–138 — orçamento/resolução adaptativos.
- src/components/game/stadium/StadiumScene.tsx:41–99 — orquestração do frame e estado de replay/drama; linhas 115–337 — composição de iluminação, campo, clima, arquibancadas, vida de estádio, jogadores, câmera e pós-processamento.
- src/game/static-stadium-batch.ts:17–22, 29–40 — batch declarado para objetos opacos imutáveis e filtros; linhas 92–144 — merge, ocultação das fontes e descarte; linhas 145–150 — reocultação das fontes.
- src/components/game/stadium/StaticBatch.tsx:31–63 — invalida e descarta o batch em mudanças de signature/configuração, espera geometria estabilizar e reconstrói; mede UUIDs de mesh/geometria, não transformações.

**Achados prioritários registrados:**
- Prioridade alta — critério de elegibilidade do batch não comprova imutabilidade: src/game/static-stadium-batch.ts:29–40 exclui meshes marcados cinematicDynamic, skinned/instanced e alguns materiais, mas não verifica animação ou alteração de transform após a consolidação. StadiumScene.tsx:259–286 coloca Floodlights, Stands, StadiumProps, Scoreboard e SidelineLife sob StaticBatch; componentes com partes realmente móveis devem ser conferidos contra esse filtro. Se uma mesh elegível mudar de posição depois do merge, o batch poderá congelar sua pose inicial enquanto a fonte fica oculta.
- Prioridade média — a estabilização em StaticBatch.tsx:44–59 compara apenas UUIDs das geometrias-fontes. A assinatura explícita e textureRevision cobrem alterações declaradas, mas transformações/material state que mudem sem alterar esses valores não acionam rebake; verificar se todos os produtores atualizam signature ou substituem geometria quando necessário.
- Prioridade média — StadiumScene agrega composição e lógica de evento/estado de replay em um módulo de 364 linhas (linhas 62–99 e 115–337), o que aumenta acoplamento entre orçamento, apresentação e subsistemas. É oportunidade de decomposição, não defeito funcional demonstrado.
- Prioridade baixa — testes disponíveis cobrem limites geométricos de ArenaArchitecture e ownership do StaticBatch, mas não demonstram lifecycle real de WebGL/WebGPU, perda/restauração em navegador, ausência de leaks em remontagens, correção visual do batch ou metas de FPS/memória. O código observado de descarte é explícito em StaticBatch e ArenaArchitecture; não se pode inferir cobertura abrangente a partir dos testes existentes.

**Próximos passos originalmente recomendados:**
- Verificar nos componentes StadiumProps, SidelineLife, Stands, Scoreboard e Floodlights quais meshes mudam transform/material durante useFrame e assegurar que não sejam consolidadas ou que suas transformações sejam reaplicadas ao batch.
- Adicionar testes para transformação/geometry churn, cleanup idempotente e rebuild de StaticBatch; incluir cenário de desmontagem/remontagem e recursos compartilhados.
- Considerar separar StadiumScene em camadas focadas (iluminação/ambiente, superfícies, vida/cena dinâmica, apresentação/lances e pós-processamento), mantendo a ordem de render explícita.
- Executar, em ambiente apropriado, testes visuais e de lifecycle com WebGL context loss/restoration e WebGPU device loss; coletar draw calls, triângulos, memória e frame-time em perfis de qualidade/dispositivos representativos.

## 4. `static-audit-other-monoliths` — src/components/game, src/game, src/routes

**Status registrado:** concluído — somente leitura; sem testes executados.

Principais monólitos ainda presentes concentram-se em dados de ligas, simulação, animação e cenas 3D. Há ciclos de dependência estática em simulação e em componentes de estádio; uma extração sem quebrar os ciclos deve começar por dependências/tipos compartilhados, não por mover blocos isoladamente. AGENTS.md exige módulos irmãos com o arquivo original reexportando a API pública e define requisitos de paridade determinística para simulação.

**Evidência registrada:**
- Contagem local de linhas: src/game/data/leagues-access.ts (2.308), leagues-api.ts (1.972), leagues.ts (1.173); src/game/sim.ts (1.671); animation-extra.ts (1.480), animation-extra2.ts (1.452), animation-extra3.ts (556); player-sculpt.ts (1.210); player-career/engine.ts (1.093).
- Componentes: src/components/game/career-shell.css (2.713 linhas), cinematic/CutsceneStage.tsx (952), stadium/StadiumStructure.tsx (825), players/PlayerStudio.tsx (644). Routes: api/public/payments/-webhook.test.ts (11.445), api/public/payments/webhook.ts (10.653), api/public/sync-football.ts (6.713).
- AGENTS.md:48 exige mover comportamento MatchSim para src/game/sim-*.ts preservando o código e confirmando paridade de mesma seed; linha 49 exige dividir módulos grandes em arquivos irmãos mantendo reexports no arquivo original; linha 54 fixa composição de estádio em stadium/StadiumScene.tsx e ciclo do renderer em Stadium3D.tsx; linha 57 exige preservar ordem de imports CSS da carreira.
- Ciclo de estádio detectado: Stadium3D.tsx → stadium/StadiumScene.tsx → StadiumStructure.tsx/StadiumTurf.tsx/StadiumBall.tsx/StadiumWeather.tsx/StadiumFloodlights.tsx/StadiumGoals.tsx → Stadium3D.tsx; por exemplo Stadium3D.tsx:27 importa StadiumScene e StadiumStructure.tsx:27 importa Quality de Stadium3D.tsx.

**Achados prioritários registrados:**
- P1 — src/game/data/leagues-access.ts e leagues-api.ts são grandes arquivos de dados (mais de 1.900 linhas cada), com baixo acoplamento aparente: ambos importam somente tipos de ../types. Fronteira mais segura: dividir por blocos/país ou fonte em módulos irmãos e compor/exportar a lista pública em leagues.ts, preservando ordem e IDs; validar contagens e conteúdo exportado.
- P1 — sim.ts continua com 1.671 linhas apesar de já delegar lógica a sim-*.ts. A fronteira de extração indicada em AGENTS.md é comportamento em funções que recebem o sim, membros compartilhados @internal e não private. Evitar ciclo adicional: isolar contratos/regras comuns antes de novos helpers, conservar draw order e comparar mesma seed/replay contra versão anterior.
- P1 — ciclo de dependência no estádio acopla filhos ao componente que mantém o lifecycle/Quality. Para extrações seguras, mover tipos compartilhados como Quality a módulo neutro e manter Stadium3D.tsx como owner do renderer e StadiumScene.tsx como compositor, conforme AGENTS.md:54; verificar referências externas/reexports antes de alterar a API.
- P2 — engine.ts de player-career (1.093 linhas), career-world.ts (709), CutsceneStage.tsx (952), StadiumStructure.tsx (825), PlayerStudio.tsx (644) e career-shell.css (2.713) são candidatos a extração em fronteiras de apresentação, cálculo ou CSS já isoláveis. Garantir reexports no owner original segundo AGENTS.md:49; não misturar extração CSS com alegação de redução de bytes, e preservar a ordem shell/screens/office (linha 57).

**Próximos passos originalmente recomendados:**
- 1. Confirmar grafo e consumidores dos maiores módulos, registrando exports públicos/ordem dos dados e resolver aliases/reexports existentes antes de planejar API.
- 2. Começar por dados de ligas: separar blocos sem alterar conteúdo e reexportar/compor em leagues.ts; comparar IDs, totais, ordenação e memberships.
- 3. Para sim.ts, seguir literalmente AGENTS.md:48: uma extração pequena por vez para sim-*.ts, helpers com estado explícito recebido como parâmetro, sem mudar draw order; obter evidência de paridade de mesma seed antes de prosseguir.
- 4. Desacoplar ciclos pelos tipos/contratos neutros primeiro (notadamente Quality do estádio); manter ownership de renderer e composição definidos em AGENTS.md:54.

## 5. `jogomanager-import-limits-audit` — Importador e limites de requisição

**Status registrado:** auditoria_estatica_concluida.

A configuração versionada não atende 1.100 requisições/minuto nem 445.000/dia. O caminho direto API-Football reserva cotas globais de até 450/min e 75.000/dia; uma configuração de fila durável arquivada limita os tetos nominais a 450/min e 75.000/dia e admite apenas cerca de 405/min e 71.250/dia após margem de segurança. Sem acesso a estado operacional, não é possível confirmar quais migrations estão aplicadas ou a cota da conta provedora. Nenhum limite foi alterado, serviço chamado ou teste executado.

**Evidência registrada:**
- `src/lib/apifootball-client.server.ts:35-50`: toda chamada do cliente direto reserva `reserve_api_football_quota` antes do `fetch`; o cliente lê a chave apenas do ambiente (não lido), e fixa timeout de até 20 s.
- `supabase/migrations/20261018130959_restore_api_football_backend_oct18.sql:231-266`: a função de reserva define teto absoluto de 75.000/dia e 450/minuto; `api_football_import_progress.batch_size` tem padrão 30 e faixa 1–50 nas linhas 4–16.
- `src/lib/apifootball-client.server.ts:62-99`: até três tentativas; 429, corpo com `rateLimit` e HTTP 5xx podem ser repetidos, cada tentativa passa pela reserva global. `Retry-After` numérico é respeitado com limite de 8 s; cabeçalho HTTP-date não é interpretado.
- `src/lib/apifootball-client.server.ts:125-151,192-220,246-273`: pools paralelos até quatro workers por liga/equipe, com deadline e checkpoints por offset; paginação integral é limitada por `maxPages` e falha, sem truncamento silencioso, em `pagedAll` (222–233). Estatísticas processam até quatro páginas por chamada (`src/lib/apifootball-matches.server.ts:95-136`).

**Achados prioritários registrados:**
- P1 — Incompatibilidade quantitativa: os limites codificados para API-Football são substancialmente inferiores aos 1.100/min e 445.000/dia solicitados; esses valores não podem ser alcançados com os tetos atuais, independentemente do paralelismo.
- P1 — Limites configuráveis e limites globais precisam ser reconciliados: a fila arquivada reduz a admissão para ~90%/95% dos valores configurados, enquanto outro fluxo usa `reserve_api_football_quota` com 450/75.000. Há risco de entender o teto nominal como throughput admissível e de divergência se ambos os caminhos estiverem disponíveis.
- P1 — Janelas de quota do SQL são buckets fixos de minuto/dia (UTC), não janela móvel; podem permitir rajadas ao redor da troca de bucket. Os dois caminhos versionados também não demonstram um único limitador compartilhado entre execuções caso a função/tabela RPC difira entre eles.
- P2 — Retry e custo: cada repetição consome outra reserva; 429/5xx geram até três tentativas no cliente, e `Retry-After` em formato de data não é respeitado. A resposta HTTP 503 do endpoint da rota gerenciada pode ainda ser reexecutada pelo agendador externo. Sem jitter/coordenação, múltiplas execuções podem sincronizar retries.

**Próximos passos originalmente recomendados:**
- Validar por meio de evidência operacional autorizada, sem inferir do repositório, qual worker, rota, conjunto de migrations e configuração de quota estão efetivamente ativos; obter a cota contratual do provedor sem expor credenciais.
- Antes de qualquer ajuste, definir se 1.100/min e 445.000/dia são limites do plano, metas de capacidade ou máximos de segurança; se forem máximos, confirmar que a API contratada os suporta. Documentar a margem de segurança e o throughput que ela implica.
- Unificar os caminhos manual e agendado sob o mesmo controle atômico global e dimensionar a proteção como janela móvel ou token bucket, levando em conta concorrência, retries e fronteiras de minuto/dia.
- Adicionar rate limiting/cooldown de invocação, jitter e interpretação de `Retry-After` em segundos e HTTP-date; auditar as respostas 429/5xx e garantir que retries e cron não excedam orçamento de custo.

## 6. `firebase-static-audit` — Ativação e integração Firebase

**Status registrado:** Auditoria estática concluída; build/testes não executados.

Há implementação de Firebase Web e opt-in de FCM, mas ativação real depende de configuração externa. Analytics é condicionado ao consentimento; credenciais Admin não são retornadas ao cliente. Foram identificadas inconsistências documentais sobre o worker usado pelo push e uma limitação de limpeza no logout.

**Evidência registrada:**
- src/lib/firebase.ts:7-47 inicializa o app no navegador sob demanda, valida apiKey/projectId/appId e inicia Analytics apenas quando solicitado e há measurementId.
- src/lib/firebase-config.functions.ts:9-41 resolve configuração via função server-side; o ramo do conector retorna apenas identificadores web/VAPID, enquanto a configuração legada usa defaults de projeto e não fornece default para API key ou VAPID.
- src/lib/firebase-push.ts:14-98 exige suporte, usuário autenticado e clique explícito antes de pedir permissão; registra /firebase-messaging-sw.js com escopo /firebase-push/, obtém token FCM e grava em push_subscriptions. Falhas retornam mensagens ou são capturadas pela interface.
- src/components/privacy/FirebasePushControl.tsx:20-54 desabilita ativação quando a configuração pública ou suporte do navegador faltam; src/components/privacy/ConsentCenter.tsx:90-96 mantém Analytics como escolha opcional.

**Achados prioritários registrados:**
- Médio — A documentação afirma que /sw.js mantém o offline e trata mensagens push (docs/firebase-web-push-setup.md:11), mas o fluxo de inscrição FCM fornece explicitamente outro registro e outro escopo (/firebase-messaging-sw.js; src/lib/firebase-push.ts:70-79). O handler push em public/sw.js pode não participar das inscrições feitas por esse fluxo. Atualizar a documentação para refletir o worker FCM dedicado e validar os dois fluxos em homologação.
- Médio — O funcionamento em produção não pode ser considerado ativado apenas pelo código: a conexão Firebase, VAPID pública e, para envio server-side, credenciais/configuração do gateway precisam existir no runtime correto e pertencer ao mesmo projeto. A ausência de API key/VAPID deixa o controle indisponível; não foi verificada a configuração externa.
- Baixo — O logout é best-effort, não garantia de remoção: a limpeza pode exceder o limite de 2 segundos ou falhar antes do signOut (src/lib/logout.ts:7-19). A interface pode ainda reter estado local de inscrição após logout; isso deve ser contemplado no comportamento de conta compartilhada.
- Baixo — Há defaults legados para identidade Firebase no ramo alternativo (src/lib/firebase-config.functions.ts:24-40); embora a ausência de API key impeça inicialização, defaults podem direcionar inadvertidamente a configuração ao projeto antigo se apenas parte das variáveis for fornecida. Preferir configuração completa e validar que todos os campos correspondem ao mesmo projeto.

**Próximos passos originalmente recomendados:**
- Corrigir docs/firebase-web-push-setup.md para descrever /firebase-messaging-sw.js e seu escopo, distinguindo-o do /sw.js offline.
- Configurar e validar, fora desta auditoria, o conjunto completo de identificadores web e VAPID pública no runtime; confirmar que pertencem ao mesmo projeto e que o domínio está autorizado.
- Confirmar separadamente o caminho server-side de envio e permissões/segredos no ambiente apropriado, sem expor credenciais ao cliente.
- Em homologação, verificar opt-in/recusa, inscrição e remoção por dispositivo, logout após falha/timeout, recebimento em navegadores suportados e comportamento em preview.

## 7. `supabase-growth-performance` — Supabase: crescimento e performance

**Status registrado:** concluido_leitura_estatica_sem_consultar_banco.

A auditoria foi somente leitura e não conectou ao banco. O schema Drizzle está deliberadamente vazio; a definição operacional reside nas migrations Supabase. Evidências históricas apontam concentração de armazenamento em api_football_data e crescimento relevante da fila de importação. Existem índices, tuning de autovacuum, relatório da fila e estatísticas do Postgres, mas não foi encontrada uma série temporal/retenção formal de métricas. As medições citadas são fotografias de outubro/novembro de 2026 e não representam o estado atual.

**Evidência registrada:**
- drizzle/schema.ts:1-2 — arquivo gerado intencionalmente em branco; não é inventário utilizável do schema.
- docs/relatorio-auditoria-webcore-seo-supabase-2026-10-23.md:64-80 — fotografia de 23/10: database 10,81 GiB; 92,35% cache hit acumulado; ~201.677 linhas estimadas em players; 63 alertas de índice não utilizado; documenta limites de contadores acumulados e necessidade de comparar deltas em janelas equivalentes.
- docs/relatorio-auditoria-webcore-seo-supabase-2026-10-23.md:88 — fotografia histórica: api_football_data 5.153.909 linhas e 8.302 MB (~75% do banco); football_import_private.jobs 3.740.905 pendentes e ~1.263 MB entre heap e índices.
- docs/report-2026-11-06-remaining-plan.md:16-17 — pg_stat_statements estava disponível; médias acumuladas do mercado ~1.002/1.049 ms. Um EXPLAIN ANALYZE documentado baixou de 3.597,495 ms/133.451 blocos em cache para 3,040 ms/124, com três amostras posteriores abaixo de 0,51 ms; ressalva explícita de amostra não universal.

**Achados prioritários registrados:**
- P1 — Risco de crescimento concentrado: os números históricos situam api_football_data em ~75% do armazenamento; repetir inventário de tamanho por relação e sua evolução é prioritário. Não se deve inferir que os valores de 23/10 ainda sejam atuais.
- P1 — Retenção/expurgo não evidente na fila: jobs e receipts são duráveis, receipts referenciam jobs e o status preserva contagens; migrations examinadas não definem retenção nem rotina de limpeza. Evidência histórica mostra milhões de jobs pendentes. Medir primeiro estados/idade/tamanho e definir retenção com validação funcional antes de qualquer exclusão.
- P2 — Instrumentação parcialmente disponível: pg_stat_statements e football_queue_status são citados/documentados, porém seus contadores/somas são acumulados e não substituem snapshots seriados, métricas de Reports nem percentis por janela.
- P2 — Índices requerem avaliação por workload: migrations acrescentam índices para consultas de futebol e fila, e há 63 alertas históricos de índices não usados. A própria documentação alerta que advisor não justifica DROP: cruzar pg_stat_user_indexes, consultas representativas e planos; incluir custo de escrita/armazenamento.

**Próximos passos originalmente recomendados:**
- Em sessão autorizada e explicitamente read-only, coletar snapshot repetível: pg_database_size/current_database; pg_total_relation_size, pg_relation_size e pg_indexes_size por tabela/índice; n_live_tup/n_dead_tup, last_autovacuum/last_autoanalyze e contadores de scans de pg_stat_user_tables; pg_stat_user_indexes (idx_scan, idx_tup_read/fetch). Usar whitelist de schemas relevantes e LIMIT explícito em leituras paginadas.
- Para fila, consultar apenas agregados: COUNT por status/kind, MIN/MAX(created_at ou timestamps disponíveis), idade dos pendentes/failed/done e tamanho total das relações jobs/receipts. Observar que jobs não tem created_at na definição examinada; usar timestamps existentes ou recomendar futura coluna/métrica, sem alteração nesta auditoria.
- Comparar snapshots com timestamps e intervalos equivalentes; para pg_stat_statements comparar deltas de calls, total_exec_time, rows, shared_blks_read/hit e temp_blks, sem resetar estatísticas. Verificar disponibilidade/permissões das colunas na versão antes de executar.
- Para suspeitas de consulta, obter SQL normalizado e testar EXPLAIN (FORMAT JSON) primeiro; EXPLAIN ANALYZE executa a consulta e só deve ser usado após revisão do custo e em ambiente seguro/representativo. Não executar manutenção ou remoção de índices a partir deste relatório.

## 8. `jogomanager-backend-rls-audit` — Segurança de backend e RLS

**Status registrado:** revisão estática concluída; sem chamadas a serviços, testes ou alterações.

A revisão das migrações e handlers locais encontrou bons controles recentes em pagamentos, RPCs privilegiadas e salas multiplayer, mas também uma exposição de leitura não autenticada no Worker de importação e um contrato de idempotência incompleto no recebimento de webhooks de pagamento. O escopo não continha arquivos em src/lib/server. Conclusões baseadas apenas no estado local do repositório.

**Evidência registrada:**
- cloudflare/sportsdb-importer/index.js:623-625 restringe por segredo as rotas /import* e /init; porém /api/status e /api/* são tratadas separadamente e não passam por essa verificação (linhas 640-742), permitindo leitura sem autenticação dos dados do D1, incluindo detalhes de importação recentes.
- cloudflare/sportsdb-importer/index.js:139-142 e 615-622 define CORS * e permite cabeçalhos arbitrários; CORS não constitui autenticação e amplia o acesso cross-origin às rotas de leitura sem autenticação.
- supabase/migrations/20261018130949_restore_commerce_backend_oct18.sql:35-60 registra eventos de pagamento e permite repetir eventos em estado retry, mas begin_payment_webhook_event recebe apenas event_id/event_type e não vincula a transição a uma assinatura/verificação criptográfica; essa validação precisa ocorrer no handler antes da chamada RPC.
- supabase/migrations/20261018130949_restore_commerce_backend_oct18.sql:98-102 remove escrita de authenticated/anon em user_purchases e deixa fulfill_store_purchase executável somente por service_role; purchase_payment_reviews tem RLS e filtro por compra própria (linhas 25-33).

**Achados prioritários registrados:**
- Alta — exposição de dados via API do Worker: /api/status, /api/leagues, /api/teams, /api/players e /api/events/* não exigem o segredo usado nas rotas de importação. A resposta inclui metadados de operação e dados completos de catálogo; o alcance exato depende da sensibilidade dos registros no D1. Ver cloudflare/sportsdb-importer/index.js:623-625, 640-742. Exigir autenticação nas rotas internas/operacionais ou separar catálogo público mínimo e status sanitizado; restringir CORS conforme a necessidade.
- Média — idempotência de webhook não é, por si, prova de autenticidade: begin_payment_webhook_event é uma RPC privilegiada de controle de estado e aceita IDs/tipos como argumentos; o código da migração não demonstra assinatura Stripe ou verificação dos dados do evento. Garantir que somente o handler que valida assinatura Stripe e payload pode invocá-la; não permitir que conteúdo não verificado alcance as RPCs de fulfillment/reconciliação. Não foi possível concluir, pela migração isolada, se essa verificação está ausente no handler implantado.
- Média/observação — rotas de leitura do Worker usam CORS universal, combinado com ausência de autenticação nos endpoints /api*. Mesmo se dados de catálogo forem intencionalmente públicos, limitar resposta de status e logs e explicitar a superfície pública; CORS não deve ser tratado como controle de acesso.

**Próximos passos originalmente recomendados:**
- Restringir ou remover o acesso público a /api/status e revisar se cada endpoint /api precisa de autenticação; sanitizar logs/status e definir allowlist CORS se aplicável.
- Inspecionar o handler de webhook de pagamento efetivamente implantado para confirmar verificação de assinatura Stripe, rejeição de eventos inválidos e chamada das RPCs somente após validação; conservar chave de idempotência e transições atômicas.
- Executar revisão complementar de privilégios efetivos no projeto Supabase implantado (grants/RLS e funções instaladas), sem inferir que as migrações locais correspondam ao estado de produção.

## 9. `dependency-lock-audit` — Dependências e lockfiles

**Status registrado:** concluído — auditoria estática somente leitura.

As dependências diretas de package.json aparentam estar refletidas em package-lock.json e bun.lock. Há um override declarativo no escopo pnpm que não está configurado na seção overrides do npm/Bun, e o workflow de reconciliação gera lockfiles com permissão de escrita em branches predeterminadas. Nenhuma vulnerabilidade foi afirmada; não executei instalação, audit, testes nem atualização.

**Evidência registrada:**
- package.json:29–48 contém overrides no formato npm, incluindo pins de re2js, seroval, qs, dompurify, hono, fast-uri e override aninhado de wrangler/undici. bun.lock:136–155 repete os overrides, mas não contém entities.
- package.json:176–179 contém pnpm.overrides.entities=4.5.0; entities aparece resolvido como 4.5.0 nos dois lockfiles (package-lock.json:8884–8885; bun.lock:1193), mas isso não demonstra que npm/Bun aplicam a declaração pnpm na resolução.
- package-lock.json e bun.lock registram vários pacotes override nas versões declaradas: dompurify 3.4.17, fast-uri 3.1.9, hono 4.13.13, qs 6.17.1 e undici 7.30.1; package-lock.json:8627–8628, 9480–9481, 10058–10059, 11719–11720, 13734–13735.
- .github/workflows/quality.yml:225–236 executa npm audit --omit=dev --audit-level=high; isso cobre dependências de produção, não as de desenvolvimento, e não inspecionei o resultado de nenhuma execução.

**Achados prioritários registrados:**
- MÉDIO — Drift de configuração de override: entities=4.5.0 está apenas em pnpm.overrides (package.json:176–179), enquanto npm e Bun dependem da versão materializada nos lockfiles e não recebem uma declaração correspondente em suas seções overrides. A versão atual coincide, mas mudanças futuras no grafo por npm/Bun podem não reproduzir a intenção de override declarada.
- MÉDIO — Reconciliação automatizada com escrita: security-lockfile-reconcile.yml concede contents: write e usa credenciais persistentes de checkout para atualizar/push em branches allowlisted. npm install --package-lock-only pode re-resolver pacotes compatíveis, então a automação pode gerar alterações transitivas além de um pin estritamente pontual. A validação `npm ci` e a inclusão restrita aos lockfiles são salvaguardas existentes, mas a promoção continua automática.
- BAIXO — Cobertura parcial de auditoria: o workflow só audita produção (`--omit=dev`), deixando dependências de desenvolvimento fora dessa verificação recorrente; isso não é evidência de vulnerabilidade.
- BAIXO — Dependência em pré-lançamento: nitro está fixado em uma versão beta exata (package.json:163), reduzindo a exposição a deriva sem revisão, mas aumenta a necessidade de acompanhar suporte, avisos e plano de saída para release estável.

**Próximos passos originalmente recomendados:**
- Escolher um único gerenciador como fonte normativa, ou replicar entities=4.5.0 no formato de override compatível com os gerenciadores realmente usados; documentar o motivo e como validar a resolução.
- Manter a automação em branches restritas e considerar revisão/aprovação antes de promover commits gerados; conferir o diff dos lockfiles para distinguir pins intencionais de re-resoluções incidentais.
- Adicionar uma auditoria separada de dependências de desenvolvimento (ou cobertura equivalente em scanner), com tratamento explícito de falsos positivos e severidade.
- Registrar responsável, cadência e critérios para atualizar/remover nitro beta; validar compatibilidade antes de trocar a versão exata.

## 10. `audit-cdn-cloudflare-headers` — CDN, Cloudflare e headers

**Status registrado:** auditoria estática concluída; estado da conta Cloudflare não verificado.

O código revisado separa dados públicos do importador e protege as rotas de importação com segredo, mas não garante diretivas de cache para suas respostas nem estabelece WAF/segurança de borda. As configurações de zona, cache, headers gerenciados, regras WAF e estado de deploy vigente exigem conferência autenticada na conta Cloudflare; nenhuma chamada remota foi feita nesta auditoria.

**Evidência registrada:**
- Não encontrei arquivos wrangler.toml/json/jsonc versionados nos caminhos inspecionados. scripts/cloudflare-deploy.mjs:8, 41-43 lê a configuração gerada em .cloudflare/production/server/wrangler.json; linhas 60-99 compõem vars públicas e não adicionam valores secretos, mantêm keep_vars e definem rotas quando CLOUDFLARE_SITE_ZONE está configurado.
- scripts/cloudflare-deploy.mjs:115-139 usa dry-run para check; deploy executa whoami, verifica nomes de segredos obrigatórios e então chama wrangler deploy. Isso é uma garantia local do script, não prova de configuração efetiva ou sucesso de publicação na conta.
- cloudflare/sportsdb-importer/index.js:623-625 aceita segredo por query string ou X-Import-Secret e exige correspondência nas rotas /import* e /init. As APIs /api/* de dados do catálogo e /api/status são públicas (linhas 640-778). A função j define CORS permissivo e Content-Type, mas nenhum Cache-Control (linhas 134-144); respostas de raiz/status também não definem política explícita de cache (linhas 627-630, 689).
- docs/dns-before-cloudflare-migration.md:33-36,  docs/cloudflare-supabase-deployment.md:140-142 registram historicamente a desativação da regra global de cache, uma regra no-store para dados privados e respostas no-store observadas. Não são confirmação do estado atual da zona.

**Achados prioritários registrados:**
- MÉDIO — Segredo de importação pode ser enviado na URL: cloudflare/sportsdb-importer/index.js:623 aceita ?secret=. Segredos em query strings podem acabar em logs, histórico, telemetria ou registros de proxy. Preferir somente header, rotacionar qualquer segredo exposto e validar/redigir logs de borda.
- MÉDIO — Respostas do Worker importador não definem Cache-Control (index.js:134-144 e 627-630). Sem verificar as regras da zona não é possível afirmar que respostas de dados públicos/operacionais não sejam cacheadas; /api/status ainda contém estado de execução e logs recentes. Definir política explícita adequada por rota e confirmar que regras CDN não sobrescrevem no-store para respostas operacionais ou privadas.
- MÉDIO/BAIXO — /api/status é público e retorna estado operacional, progresso, contagens e até 20 registros recentes com mensagens (index.js:640-689). Confirmar que esses campos não carregam dados sensíveis e limitar a resposta ao necessário; considerar autenticação ou remoção de detalhes internos.
- INFORMAÇÃO INCOMPLETA — O código sob escopo não configura WAF, rate limiting, Bot Fight Mode, TLS, regras de cache da zona ou headers de resposta globais. Estado, cobertura e exceções desses controles só podem ser confirmados no painel/API Cloudflare, que não foi acessado.

**Próximos passos originalmente recomendados:**
- No painel da zona, conferir regras de cache e ordem/escopo das regras, sobretudo bypass para rotas autenticadas, APIs e Set-Cookie/Authorization; validar os headers efetivamente publicados em respostas públicas e privadas.
- Conferir configuração atual de WAF/Managed Rules, rate limiting, Bot Fight Mode, TLS/SSL, redirecionamentos, DNS/Worker routes e certificado; comparar com os registros documentais históricos.
- Ajustar o Worker para não aceitar segredo em query string e explicitar Cache-Control por classe de resposta; depois revisar testes locais e validar comportamento apenas após autorização e em ambiente apropriado.
- Restringir ou minimizar os detalhes de /api/status e verificar se mensagens de importação podem incluir conteúdo sensível.

## 11. `jogomanager-seo-static` — SEO técnico e conformidade web

**Status registrado:** auditado; sem alterações, testes ou chamadas externas.

Há cobertura técnica razoável de titles, descriptions, canonical e JSON-LD, além de robots.txt e sitemap dinâmicos. Porém, a política global de indexação contradiz o sitemap e as páginas públicas: rotas canônicas importantes ficam sob noindex HTTP, e diversas URLs listadas no sitemap não estão na allowlist de páginas indexáveis. O sitemap também omite várias páginas editoriais/canônicas. Auditoria somente de código local; comportamento em produção não foi verificado.

**Evidência registrada:**
- src/lib/security-headers.ts: política responseIndexingPolicy é invocada na resposta HTML; src/lib/public-indexing.ts:2-22 lista páginas autorizadas e não inclui /jogo-de-manager-de-futebol, /tabelas, /tabelas/{slug}, /mercado-de-transferencias, /melhores-formacoes, /guia-de-scouting, /dicas-de-gestao, /jogar-offline e outras rotas canônicas.
- src/lib/public-indexing.ts:24-31: qualquer HTML fora da allowlist recebe política noindex, follow (exceto algumas categorias noindex,nofollow). Assim, sitemap.xml inclui rotas canônicas como /jogo-de-manager-de-futebol e /tabelas/... (src/routes/sitemap[.]xml.ts:18-32), embora a camada HTTP lhes aplique noindex.
- src/routes/sitemap[.]xml.ts:17-52: sitemap estático com 35 URLs; inclui páginas que redirecionam (p.ex. /modo-carreira-de-jogador e /guias, possivelmente canônicas válidas; lista não deriva de inventário central), mas não inclui várias rotas de conteúdo como /soccer-manager-online, /taticas-e-formacoes, /gestao-financeira, /ligas-de-futebol e /como-ser-tecnico-de-futebol; algumas dessas são redirecionamentos, mas páginas editoriais canônicas como /melhores-formacoes e /mercado-de-transferencias estão presentes. Há divergência adicional com src/lib/public-indexing.ts:4-21, que lista antigos aliases redirecionados em vez de várias URLs canônicas atuais.
- src/lib/seo.ts:81-114 fornece metadados Open Graph/Twitter e canonical absoluta baseada em https://jogomanager.com; src/routes/index.tsx:17-52 usa esses metadados e Website/Game JSON-LD. Páginas editoriais examinadas usam canonical e BreadcrumbList/Article em src/routes/jogo-de-manager-de-futebol.tsx:12-27 e src/routes/tabelas.$slug.tsx:18-52.

**Achados prioritários registrados:**
- P0 — Bloqueio de indexação por contradição entre camada HTTP e SEO: rotas listadas no sitemap, inclusive páginas editoriais e páginas de tabelas, não estão na allowlist PUBLIC_SEARCH_PAGES e recebem X-Robots-Tag noindex, follow via security-headers. Isso neutraliza a intenção de indexá-las apesar de canonical e sitemap. Corrigir primeiro a allowlist para URLs canônicas pretendidas e alinhar o inventário.
- P1 — Sitemap não representa o inventário canônico: é uma lista manual em src/routes/sitemap[.]xml.ts e diverge tanto da allowlist quanto das rotas públicas. Há conteúdo indexável omitido e aliases/redirects registrados em public-indexing.ts. Gerar sitemap a partir de um único inventário de URLs finais indexáveis, excluindo redirects, noindex e telas privadas; verificar correspondência com status/canonical.
- P1 — Consistência de publicação/SEO não verificada: base URL é derivada da requisição em sitemap/robots (src/lib/site-host.ts é a implementação relacionada), enquanto canonical e OG usam SITE_URL fixo (src/lib/seo.ts:1, 71-74). Isso pode divergir em hosts/ambientes alternativos; revisar especificamente que produção emita domínio canônico único e que ambiente de preview não gere indexação inadvertida. Não foi avaliado valor retornado em runtime.
- P2 — Dados estruturados: há WebSite, Organization, Game, Article, BreadcrumbList e FAQPage em rotas selecionadas; não há evidência nesta inspeção de cobertura uniforme para todas as páginas. Verificar correspondência estrita entre JSON-LD e conteúdo visível, sobretudo FAQPage gerado para tabelas, e validar dados estruturados publicados antes de ampliar cobertura.

**Próximos passos originalmente recomendados:**
- Alinhar src/lib/public-indexing.ts à lista de URLs canônicas desejadas e garantir que páginas públicas destinadas à busca não recebam X-Robots-Tag noindex; manter noindex explícito para telas de jogo/conta e operações privadas.
- Definir inventário único de páginas SEO e usá-lo para allowlist, sitemap e, se apropriado, llms.txt. No sitemap, manter apenas URLs finais indexáveis com canonical autorreferente; remover aliases e redirects.
- Adicionar checagens automatizadas estáticas para cada URL do sitemap: existência de rota, URL canônica, ausência de noindex e exclusão de redirects; verificar também URLs públicas previstas que faltam no sitemap.
- Em ambiente autorizado de validação, conferir respostas HTML e cabeçalhos X-Robots-Tag, status/redirect, canonical, sitemap, robots e JSON-LD no domínio de produção; esta auditoria não fez requisições externas.

## 12. `email-webhooks-data-audit` — Email, webhooks e exposição de dados

**Status registrado:** revisão estática concluída; sem execução de testes ou chamadas externas.

O transporte Resend implementa autenticação por bearer, timeout, retries limitados e chave idempotente; os riscos mais relevantes observados são o segredo de importação Cloudflare aceito em query string e endpoints públicos sem paginação/rate limit explícito. Não foi encontrada implementação de webhook de email nos caminhos examinados. A inspeção avalia código, não deliverability nem estado atual dos provedores.

**Evidência registrada:**
- src/lib/email-templates/send-email.ts:35-40, 67-81 lê chaves apenas durante o envio; não imprime nem retorna seus valores. Suporta Resend ou Lovable conforme configuração e gera chave aleatória quando não é fornecida uma chave de idempotência.
- src/lib/email-templates/resend-transport.ts:17-46 envia bearer via header, usa timeout de 15 s, limita tentativa adicional a 429/5xx e reutiliza Idempotency-Key; a resposta de erro inclui status HTTP, sem corpo do provedor.
- cloudflare/sportsdb-importer/index.js:623-625 aceita segredo em query (`secret`) ou cabeçalho e protege `/import*` e `/init`; index.js:138-142 define CORS wildcard. index.js:640-778 serve APIs de dados sem verificação de autenticação aparente.
- cloudflare/sportsdb-importer/index.js:686-689 retorna 20 registros de importação recentes no status; 691-776 executa consultas sem paginação explícita. GET `/api/status` também chama `initSchema` em 640-642.

**Achados prioritários registrados:**
- ALTO — Segredo de importação pode ser transmitido em URL: `index.js:623-625` aceita `?secret=...`. URLs podem persistir em logs de acesso/monitoramento e ser copiadas ou expostas em histórico; usar exclusivamente header, rejeitar o parâmetro e rotacionar qualquer segredo previamente usado em query.
- MÉDIO — Endpoints `/api/*` aparentam ser públicos e permitem leitura ampla de dados e consumo de recursos: `index.js:640-778` não aplica autenticação, paginação nem limite de resultados visível; `index.js:686-689` ainda divulga mensagens de importação recentes. Confirmar que a publicação é intencional, minimizar campos/logs e impor limites/paginação/rate limit conforme necessidade.
- MÉDIO — `sendTemplateEmail` declara ser server-only, mas não há guarda/importação explícita que impeça inclusão acidental em código cliente (`send-email.ts:1-7`). Isolar por módulo server-only e verificar referências/importações nos pontos de chamada antes de habilitar o envio.
- BAIXO/MÉDIO — Validação de destinatário e reply-to não é feita no limite do transporte (`send-email.ts:53-60, 67-80`); `templateData` é aceita em runtime e alguns templates usam `siteUrl` dinâmico para links. Validar formato/allowlist e normalizar URLs antes do envio, especialmente se dados vierem de entrada não confiável; risco depende dos chamadores, não avaliados aqui.

**Próximos passos originalmente recomendados:**
- Remover suporte a segredo em query string dos endpoints de importação; exigir segredo somente em header e planejar rotação segura do segredo operacional.
- Decidir explicitamente se `/api/*` deve ser público; limitar campos e resultados, acrescentar paginação e proteção de abuso, e evitar expor mensagens internas de erro/log.
- Adicionar barreira de build server-only e revisar os chamadores de `sendTemplateEmail` para autenticação/autorização, validação de destinatário, URLs, reply-to e limites de envio.
- Se webhooks forem necessários, implementar verificação criptográfica da assinatura sobre o corpo bruto, janela temporal e prevenção de replay, idempotência, validação de payload e minimização de dados persistidos; testar com fixtures sem contato com o provedor.

## 13. `career-tutorial-audit` — Tutorial completo de carreira

**Status registrado:** auditoria estática concluída; testes não executados.

A implementação oferece um dialog de orientação em quatro capítulos e retomada local, mas não corresponde ao tutorial jogável do plano: lições são links/checklists autoassinaláveis, sem validação geral da ação, destaque contextual, capítulo de bola parada ou recompensa. Não há implementação local encontrada de concessão da recompensa de 300 moedas + relatório de olheiro. Segurança contra concessão duplicada não pode ser demonstrada porque a recompensa não está implementada; progresso do tutorial é somente client-side e não deve autorizar prêmio.

**Evidência registrada:**
- Plano: .lovable/plan/plano-carreira-fácil-de-aprender-tutorial-completo-novos-ser-2026-11-06.md:7-16 pede quatro capítulos jogáveis, progresso salvo, pular/retomar, recompensa única por conta e suporte a carreira de treinador e jogador; critérios em 134-138.
- Implementação: src/game/career-tutorial.ts:36-122 contém quatro capítulos e dez lições; cobre clube/objetivos, elenco/tática, pré-jogo/partida e treino/olheiros/finanças/contratos. Não há lição explícita de moedas, loja ou estádio.
- src/components/game/CareerTutorialDialog.tsx:25-40 salva marcações em localStorage sob jm.tutorial:<careerKey>; 65-71 encaminha para uma tela; 93-120 permite marcar manualmente “Já pratiquei”; 127-134 oferece limpar marcações e link para FAQ.
- src/game/career-tutorial.ts:1 declara que progresso é apenas orientação e nunca autoriza recompensa; :5-27 reconhece automaticamente partida concluída, treino e relatório de olheiro, mas não as demais ações.

**Achados prioritários registrados:**
- ALTO — Critérios centrais do plano não implementados: não há fluxo que condicione avanço a ações reais para a maioria das lições; botão “Já pratiquei” altera o progresso sem comprovação. Nenhum destaque do botão correto, dica durante a partida, pausa/retomada da ação ou versão rápida foi identificado.
- ALTO — Recompensa de conclusão (300 moedas e relatório) ausente no escopo pesquisado. Assim, os critérios de concessão única por conta e proteção contra fraude/idempotência não são satisfeitos nem verificáveis; localStorage é editável pelo cliente e não constitui fonte confiável para conceder recompensa. A implementação corretamente comenta que o progresso não deve autorizar moeda.
- MÉDIO — Cobertura temática parcial: primeiro capítulo não cobre moedas; segundo não menciona bolas paradas nem arrastar jogadores; capítulo de partida só contém instrução estática; gestão inclui treino/olheiros/finanças/contratos, mas omite mercado, estádio e loja. O capítulo bônus de bola parada não existe.
- MÉDIO — O plano requer funcionamento também na carreira de jogador com capítulos próprios. A função e o dialog usam CareerState da carreira geral; não foram encontrados capítulos ou ramificação específicos para carreira de jogador (treinos, notas, contratos).

**Próximos passos originalmente recomendados:**
- Implementar a recompensa exclusivamente no servidor com validação de conclusão e chave idempotente por usuário; adicionar testes de repetição/concor­rência e assegurar que progresso local não concede prêmio.
- Transformar lições em etapas acionáveis com validação de evento/estado, destaque contextual e dicas na partida; completar moedas, bola parada, mercado, estádio/loja e capítulos específicos da carreira de jogador.
- Definir explicitamente o modelo de persistência e chave de progresso por conta/carreira, incluindo retomada entre dispositivos se isso for requisito.
- Executar o teste dedicado e a suíte conforme scripts existentes, registrar comandos e resultados; não foram executados nesta auditoria somente leitura.

## 14. `audit-tests-visual-release-gates` — Testes, evidência visual e release gates

**Status registrado:** Auditoria estática concluída; gates não executados nesta auditoria.

A infraestrutura de CI define gates amplos para lint, TypeScript, testes, build, bundles, stress determinístico, replay de banco, gráficos 3D e Lighthouse desktop/mobile. Evidência documental recente registra lint/build e testes focados, mas declara expressamente que os gates completos não foram executados. Esta auditoria foi somente leitura; nenhum teste foi executado.

**Evidência registrada:**
- .github/workflows/quality.yml:17-39 executa lint, tsc --noEmit, Vitest, testes Node, gates de performance, build e bundle:check. Linhas 48-68 exigem stress de 200 partidas e replay independente; linhas 70-98 comparam construção da simulação; linhas 100-127 falham o gate agregado se qualquer verificação crítica não passar.
- .github/workflows/quality.yml:129-157 define replay local de migrações; linhas 159-223 definem contratos gráficos e Lighthouse desktop/mobile; linhas 238-280 incluem validações Rust/WASM.
- docs/report-2026-11-07-broad-ux.md:10-15 registra 11 arquivos/60 testes focados, lint sem erros/avisos, build reportado como OK, inspeção de screenshots desktop/mobile e fluxo autenticado; especifica que renderização Canvas não constitui alegação de desempenho de GPU física.
- docs/report-2026-11-07-broad-ux.md:17-22 declara conflito de sincronização cloud, ausência de garantia de durabilidade, gates completos não executados (stress, comparação, bundle, contratos gráficos, Lighthouse desktop/mobile, replay e SHA exato) e certificação em dispositivo físico indisponível.

**Achados prioritários registrados:**
- P1 — Release não está comprovado: o relatório de 7 de novembro diz que os gates completos obrigatórios não foram executados. Não há nesta inspeção resultados CI ou artefatos atuais para confirmar aprovação do SHA exato.
- P1 — Evidência de desempenho visual é limitada por desenho: capturas e métricas automatizadas usam Chromium/SwiftShader e submissões WebGL; não provam FPS de apresentação em hardware móvel nem certificação física. O relatório também confirma que essa certificação não ocorreu.
- P2 — O workflow `quality.yml` cobre typecheck/lint/test/build e gates abrangentes, mas a existência da configuração não comprova execução bem-sucedida; verificar resultados e artefatos do commit candidato antes de release.
- P2 — Há documentação de screenshots desktop/mobile inspecionados no ciclo recente, mas os screenshots correspondentes não aparecem como evidência versionada do ciclo no inventário; as evidências visuais automatizadas são artefatos de workflow com retenção de 14 dias.

**Próximos passos originalmente recomendados:**
- Consultar os resultados efetivos do workflow `Quality gates` e respectivos artefatos para o SHA de release, verificando todos os jobs críticos, inclusive Lighthouse mobile, stress, bundle-impact e replay.
- Executar typecheck, lint, testes, build e demais gates em ambiente CI compatível com Node 24.22.0; registrar apenas resultados efetivamente obtidos.
- Revisar os artefatos do workflow `Match 3D visual evidence` para o mesmo SHA e manter a ressalva de que evidência SwiftShader/emulada não substitui validação em dispositivo físico.
- Antes de declarar release aprovado, confirmar explicitamente a aprovação do gate agregado `critical-performance` e o SHA exato a publicar; publicação não foi realizada nem autorizada nesta auditoria.

## 15. `backlinks-domain-security-static` — Backlinks e segurança de domínio

**Status registrado:** parcial — inspeção estática local concluída; perfil de backlinks e segurança externa não verificáveis neste checkout.

Não encontrei exports locais de Ahrefs/Search Console nem datasets de backlinks/referring domains; portanto, não há base para classificar links ou estimar risco/toxicidade. Há sinais técnicos locais de SEO: domínio canônico jogomanager.com, metadados/canonical, sitemap e robots.txt. DNS, propriedade/verificação no Search Console, reputação de backlinks e controles ativos do domínio dependem de fontes externas não consultadas.

**Evidência registrada:**
- A busca por nomes de arquivo e extensões de export não encontrou arquivos Ahrefs, backlinks, refdomains, GSC/Search Console nem exports relacionados. A documentação local examinada também não continha um dataset de links.
- src/lib/seo.ts:1-17 define SITE_URL=https://jogomanager.com, marca, título, descrição e palavras-chave; linhas 70-74 formam URLs sem parâmetros/fragmentos; linhas 81-116 compõem meta tags e canonical; linhas 118+ incluem dados estruturados.
- src/lib/site-host.ts:4-12 explicita que preview e domínios próprios devem apontar para um único endereço canônico, https://jogomanager.com.
- src/routes/sitemap[.]xml.ts:12-17 e 54-78 gera sitemap.xml com URLs sob a base canônica; contém páginas públicas declaradas entre as linhas 18-51.

**Achados prioritários registrados:**
- Prioridade alta — ausência de dados de backlinks impede análise de volume, domínios referenciadores, âncoras, evolução e eventual risco. Nenhum link foi classificado como tóxico e nenhum sinal de toxicidade pode ser inferido do código-fonte.
- Prioridade média — a camada SEO local possui identidade canônica coerente, canonical, sitemap e robots.txt; estes artefatos demonstram intenção/configuração no código, não que estejam implantados, acessíveis ou aceitos por mecanismos de busca.
- Prioridade média — não é possível verificar localmente propriedade/verificação do domínio, Search Console, DNS/NS, certificados e redirects efetivos, exposição de subdomínios, reputação/abuso ou regras atuais de segurança. O relato sobre configuração Cloudflare é histórico e não constitui validação do estado remoto.

**Próximos passos originalmente recomendados:**
- Para analisar backlinks, fornecer export recente do Ahrefs ou equivalente (backlinks, referring domains, âncoras e, idealmente, ganhos/perdas dos últimos 90 dias) e, separadamente, export do Search Console se a análise de desempenho orgânico estiver no escopo. Sem os dados, limitar-se a registrar que a fonte não está presente.
- Validar depois, por canal autorizado e somente leitura, propriedade no Search Console, canonical e sitemap reconhecidos, DNS/NS, certificado/TLS, redirects e políticas de domínio; não foi feita chamada externa nesta tarefa.
- Método seguro: revisar os exports localmente, deduplicar por domínio/URL e documentar cobertura, datas e limitações; tratar qualquer indicador como fila de revisão manual. Não preparar/submeter disavow sem evidência de links artificiais confirmados e aprovação explícita.

## Referência à captura do usuário

A captura mostra as 15 linhas de auditoria: CSS da carreira; telas/experiência da carreira; Stadium3D/renderização; outros arquivos monolíticos; importador/limites; Firebase; Supabase crescimento/performance; backend/RLS; dependências/lockfiles; CDN/Cloudflare/headers; SEO técnico; email/webhooks/dados; tutorial; testes/evidência visual/release gates; backlinks/segurança do domínio. Os identificadores e achados detalhados acima vêm do resultado textual armazenado do workflow, não de inferências visuais sobre linhas truncadas.
