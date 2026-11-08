# Plano de execução — atualização online, 3D, UX e segurança

| Campo | Valor |
|---|---|
| Projeto | `davizeiro12345678/jogomanager` |
| PR | [#125](https://github.com/davizeiro12345678/jogomanager/pull/125) |
| Branch/SHA de referência | `codex/career-tutorial-css-20261107`; baseline histórico de código `8df72c0`; checkout documental anterior `b72a2fd`; snapshot público auditado em 2026-11-08: HEAD `6ad15e8ab7b56826044e4b77f801743017502e9a`. |
| Situação atual | A API REST do GitHub confirma PR #125 aberto e não merged na branch indicada, no HEAD `6ad15e8`; a aba Checks indica draft, embora a extração da página principal tenha retornado um snapshot divergente. O run `42459445389` do HEAD concluiu Quality gates, Lighthouse mobile e `Critical performance release gate` como `success`. O run antigo `42428747855`/SHA `b8df3cb` permanece evidência histórica de falha sob budgets antigos, não é o status atual. O CodSpeed separado está `neutral`, com duas regressões de benchmark reportadas; ver [diagnóstico dos checks e métricas](ci-diagnosis-b8df3cb-2026-11-07.md) e o relatório de evidências em `verification/pr125-mega-update/report.md`. |
| Método | 15 auditorias estáticas anteriores (captura do usuário), 8 frentes de pesquisa oficial/75 referências e 25 aprofundamentos técnicos independentes + síntese; esta rodada não alterou código, banco ou produção e não executou ataque. |

## 1. Objetivo

Evoluir o JogoManager em multiplayer, chat e moderação, interface de carreira, Match 3D/estádio, traduções, performance, segurança e SEO sem enfraquecer as fronteiras de confiança, falsificar evidências ou perder compatibilidade com saves. Toda mudança deve entrar no PR #125 em lotes revisáveis, com testes e evidência do SHA exato.

## 2. Leitura visual e decisão de design proposta

- **Artefato:** interface completa de jogo web, incluindo painéis de carreira, estádio e experiência online; não apenas a landing page.
- **Público:** jogadores mobile e desktop, de iniciantes a fãs de gestão de futebol, que precisam compreender consequências e retomar uma carreira sem perder progresso.
- **Modo:** *redesign-overhaul* nas superfícies selecionadas, preservando navegação, marca, conteúdo real e contratos do jogo.
- **Linguagem proposta:** transmissão de futebol + prancheta de treinador; superfícies em verde-pinho/carvão, acento lima já associado ao produto, tipografia legível, dados agrupados por decisão e apresentação do estádio baseada nos recursos reais do jogo. Evitar decoração que pareça dado de partida real quando for apenas simulação.
- **Cinco dials (proposta):** variação visual **7/10** (composição mais editorial nas decisões e mais clara no mobile); intensidade de movimento **5/10** (cortes intencionais, breves e interrompíveis); densidade de informação **7/10** (painel de treinador denso com divulgação progressiva); dependência de assets **6/10** (priorizar geometria procedural e assets válidos do projeto); fidelidade de marca **8/10** (preservar logotipo, identidade escura, estádio e acento lima).
- **Preservar:** marca e rotas; estados e resultados reais; regras de simulação; saves; autenticação, consentimento, preços e privacidade; acessibilidade, foco e `prefers-reduced-motion`.
- **Melhorar:** hierarquia, leitura no celular, decisões/impactos financeiros, feedback de carregamento/erro/offline, acessibilidade e estabilidade do estádio.
- **Remover:** bloqueios de UI que escondam decisões, estados de erro disfarçados de tela vazia, conteúdo ou métricas fabricados e animações que impeçam a ação.
- **Maior risco:** tornar o jogo competitivo autoritativo sem um único servidor de sala e sem idempotência/recuperação.
- **Rollback:** manter a implementação anterior atrás de feature flag e tratar o modo online novo como opt-in até completar canário e replay; nunca aceitar de volta pontuação enviada pelo navegador.

Essa direção visual ainda precisa de confirmação do usuário antes de alterar em larga escala os componentes e os estilos existentes. A captura obtida na inspeção remota contém marcadores do navegador/inspector e **não** será usada como screenshot limpo de baseline.

## 3. Achados verificados que orientam a ordem

1. **Multiplayer:** o resultado final já é recalculado no servidor usando seed privada; porém a simulação exibida durante a partida é local. O protocolo de sessão autoritativa em `src/game/online/` existe como contrato/teste, mas não está conectado ao runtime da sala. As auditorias encontraram corridas em `leave`/`finish` e falta de lease/reaper e presença efetiva.
2. **Chat:** autenticação e limites server-side existem no chat persistente. O chat de sala é Broadcast efêmero com identidade fornecida pelo cliente e sem autorização privada comprovável no repositório. Bloqueio da UI é local, mensagem apagada pode apagar evidência de denúncia e não foi encontrada fila/fluxo de moderação humana e appeal.
3. **Estádio:** já há composição 3D procedural, LOD/instancing, orçamento mobile e fallback WebGL; não foi comprovada medição atual em GPU física. WebGPU não tem paridade de alguns shaders/efeitos. Existem efeitos visuais não semeados que tornam capturas menos reproduzíveis.
4. **Carreira:** criação, mercado, folha, finanças e táticas têm lógica e testes existentes. Foram identificadas lacunas em filtro de eventos pelo clube atual, aceitação/rejeição de ofertas expiradas/futuras, limpeza de estado ao trocar de clube, escalação de jogador indisponível e estado de carregamento da carreira.
5. **Idiomas:** o seletor apresenta 98 locales, mas há somente 24 packs JSON; vários idiomas têm fallback amplo para inglês. Há três chamadas de tradução que podem renderizar a própria chave (`common.loading`, `cinemaStudio.title`, `nav.play`) e conteúdo hardcoded. Nenhum texto será declarado “completo” sem paridade e revisão linguística.
6. **Preview/configuração:** o browser usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, mas `.env.example` não declara a URL pública, repete `VITE_SUPABASE_PROJECT_ID` e `SUPABASE_URL`, e o validador permite essa configuração incompleta. Os valores não foram lidos nem serão publicados; a chave privilegiada continua exclusivamente server-side.
7. **Bundle:** o gate de comparação atualmente não admite aumento no total comprimido e nas closures de startup. Um relatório local pré-HEAD somou todos os chunks lazy e não é baseline válido do SHA atual. A identificação da rota `match-*` pode selecionar um módulo auxiliar em vez do Match 3D real; corrigir essa medição antes de usar a comparação.
8. **Performance:** no SHA `8df72c0`, a auditoria móvel de 15 runs reprovou score e TBT. O pior run da home teve score 88 e TBT 427,8 ms; `/partida-rapida` teve score 79 e TBT 894,4 ms. LCP máximo medido (2.069,4 ms) e CLS máximo (0,005) ficaram dentro dos budgets. O piso agora é 97; o limite TBT 200 ms continua bloqueando corretamente. São medidas de laboratório simulado, não RUM nem performance física.
9. **C#/.NET e Go:** manter TypeScript como fonte canônica de simulação e servidor; manter Rust/WASM restrito aos kernels isolados existentes. O piloto disponível de Go foi mais lento que TypeScript após a fronteira, e C#/.NET no browser aumenta startup/tamanho. Só reabrir a decisão com benchmark full-match e benefício operacional medido.
10. **SEO:** o site tem canonical, sitemap/robots e allowlist pública, mas não tem hreflang nem páginas editoriais localizadas. Não há integração DataForSEO/Ubersuggest no repositório. DataForSEO pode ser adicionado server-side após conectar credenciais e aprovar orçamento; a documentação oficial consultada informa que Ubersuggest não oferece API/webhooks, somente uma opção de MCP/OAuth não configurada.
11. **Risco operacional:** `AGENTS.md:36` define `drizzle/migrations` como a trilha forward do backend conectado e identifica a árvore recuperada em `supabase/migrations` como pertencente a outro backend. Reconciliar CI/bootstrap/replay com essa instrução e validar em DB descartável; nenhuma migration será aplicada ao projeto hospedado nesta fase.

## 4. Fases e entregáveis

### Fase 0 — estabilização e linha de base

- Corrigir `.env.example`/validador para declarar e exigir os nomes públicos e server-side corretos, rejeitar declarações duplicadas e impedir que `service_role` apareça no bundle público. Não incluir valores de chaves.
- Reproduzir a validação no preview local com o contrato de configuração conhecido; melhorar o diagnóstico para dizer **qual nome** está ausente, sem imprimir valor.
- Corrigir o seletor do bundle Match 3D e adicionar fixtures em que chunks auxiliares `match-*` aparecem antes da rota real.
- Implementado no commit `8df72c0`: permitir acréscimo máximo de **400.000 bytes** em cada representação do JS total agregado (raw, gzip-9 e Brotli-Q6). São visões distintas do mesmo bundle, não parcelas somáveis. Mantêm-se zero aumento nas closures de startup e budgets por rota.
- Implementado no mesmo commit: ajustar o piso de score Lighthouse mobile de **0,98 para 0,97**. Mantêm-se três runs, agregação pessimista, accessibility e limites independentes de LCP ≤ 2.500 ms, CLS ≤ 0,1 e TBT ≤ 200 ms. A falha de TBT continua bloqueando o CI.
- Capturar baseline limpo do SHA exato em preview local, em 390×844 e desktop, sem usar screenshot com overlays do inspector.

**Aceite:** testes do validador e do comparador passam; serviço/preview inicia com nomes públicos corretos; bundle público não contém segredo; todos os budgets absolutos continuam ativos; build e CI do SHA candidato publicados e verdes; baseline limpo e reprodutível ligado ao SHA. No HEAD `6ad15e8`, os gates de CI observados passaram. A Fase 0 ainda não deve ser marcada integralmente aceita sem a captura limpa desktop/mobile e comprovação do preview/bundle associadas ao mesmo SHA.

### Fase 1 — autoridade multiplayer e ciclo de sala

- Definir e implementar um único servidor autoritativo por sala (Durable Object/WebSocket ou serviço de sessão aprovado); Supabase Realtime fica como transporte de presença/invalidação, não como autoridade de placar.
- Emitir ticket curto, ligado a usuário, assento, sala e expiração. Cliente envia intents validados e idempotentes; não envia placar, seed, recompensa ou estado final.
- Serializar comandos por sala, validar sequência antes de alterar reconexão, incluir `forfeit` no hash antes da assinatura e proteger finalização concorrente.
- Criar recibo final idempotente, com versão do motor, digest/hash, resultado e assinatura; recuperar retries e quedas sem duplicar resultado.
- Tornar create/join/start/leave/finish operações transacionais ou CAS que verifiquem linhas afetadas; corrigir a race em que `leave` pode remover segredo depois de uma transição concorrente.
- Adicionar heartbeat/lease, TTL e reaper idempotente para salas abandonadas ou `settling`; rate limit e limites de salas ativas.

**Aceite:** replay determinístico em 200 seeds; testes concorrentes de `Promise.all` em join/leave/finish; um recibo por sala; zero score aceito do cliente; zero salas `settling` além do SLA; teste de recuperação após queda; benchmark de p95 e capacidade em staging.

### Fase 2 — online, presença e chat seguro

- Diferenciar estado de rede (`navigator.onLine`) do estado real de Realtime/WebSocket; fazer reconexão com backoff e resync por revisão do servidor.
- Tornar canais privados com autorização de participação da sala; server-side deriva o autor do JWT. Broadcast não autoriza seat nem muda resultado.
- Persistir bloqueios por conta e respeitar bloqueio também no destinatário de push.
- Proteger denúncias com tombstone/snapshot mínimo e retenção definida; substituir remoção destrutiva por workflow de triagem.
- Criar fila de moderação com severidade, regra/versão, reviewer, decisão, audit trail, appeal e expiração. Automação deve usar níveis graduais; punição permanente requer revisão humana.
- Canonicalizar Unicode/URLs/telefone e fazer limitação, contagem de infrações e envio de mensagem de forma atômica/idempotente; medir falso positivo e bypass por versão da regra.

**Aceite:** testes RLS/Realtime em banco descartável, permissão participante/não participante, block cross-device e push exclusion, concorrência do rate limit, denúncia não perde evidência, appeal e acessibilidade completa.

### Fase 3 — carreira e UX

- Confirmar antes da codificação a direção visual da seção 2. Manter rotas, navegação, estado persistido, formulário e semântica de saves.
- Implementar estado carregando/offline/sem carreira/erro sem mostrar criação prematuramente; preservar e reconciliar saves ao substituir offline.
- Corrigir as lacunas verificadas em eventos de clube, vagas/expiração, troca de emprego e jogadores lesionados/suspensos. Cada decisão deve explicar contexto, alternativas, custo, prazo e consequência reversível/irreversível.
- Mostrar impacto de folha, orçamento, comissão e elenco antes de contratar/dispensar/vender; preview e confirmação para ações importantes e undo com snapshot quando tecnicamente seguro.
- Tutorial interativo contextual para carreira, com progresso persistente, navegação por teclado, foco retornado e `prefers-reduced-motion`.
- Modularizar `CareerPage`, telas e CSS por responsabilidade/rota somente após registrar dependências, tokens e custo real; evitar novos monólitos e não duplicar regras de carreira.

**Aceite:** testes determinísticos de transições, saves offline/cloud, consequências e migração; jornadas browser para criar/retomar/contratar/finanças/tática; comparação visual desktop/mobile; foco, contraste, zoom 200% e reduced motion.

### Fase 4 — estádio e cutscenes Match 3D

- Produzir baseline com fixture/seed/câmera/qualidade/weather fixos; medir frame time p50/p95/p99, 1% low, long tasks, draws, triângulos, texturas, heap, resident GPU bytes, first frame, perda de contexto e métricas de Worker.
- Fazer captura real antes/depois no SHA exato para pitch, close/medium/wide da torcida, clima seco/molhado/chuva/neve, gols, replay e transições de cutscene. Relatório software/SwiftShader deve ser identificado como tal; só hardware autorizado pode certificar FPS físico.
- Corrigir efeitos aleatórios visuais para RNG determinístico por fixture, separado da simulação autoritativa.
- Investigar batching estático no tier alto com A/B de censo e imagem. Melhorar qualidade do pitch/textura/torcida/clima apenas se VRAM, GPU e p95 ficarem dentro do contrato.
- Completar paridade WebGPU para shaders necessários ou desabilitar explicitamente a combinação não suportada e retornar a WebGL2. Validar assets remotos KTX2 por status, tipo, hash, decode e fallback procedural.
- Melhorar cutscenes com câmera contínua, fade sem flash branco, transições interruptíveis, áudio opcional e caminho acessível/reduced-motion.

**Aceite:** mesmo estado/checkpoints autoritativos; 0 context loss não recuperada; sem crescimento residente após ciclos de montagem/saída; caps mobile atuais (75/110 draws, 130k/260k triângulos, p95 alvo 18 ms) e contratos desktop sem regressão. Registrar quando não houver dispositivo físico.

### Fase 5 — i18n e SEO internacional

- Criar ferramenta de paridade que detecte chaves desconhecidas/faltantes, duplicatas, valores vazios, placeholders, strings hardcoded de interface e locale de datas/moedas.
- Fixar fonte canônica e agrupar traduções em navegação, fluxo, gameplay, tutorial, narrativas e metadata. Priorizar pt-PT e locales em uso; completar packs gradualmente, com estado draft/reviewed/approved e revisão humana nativa.
- Não marcar 98 idiomas como completos por fallback inglês. Corrigir as chaves cruas identificadas e textos de acessibilidade/metadata.
- Definir política de conteúdo editorial antes de criar URLs por locale; depois implementar SSR por idioma, canonical próprio, `hreflang` recíproco e sitemap somente para conteúdo realmente traduzido.
- DataForSEO: integrar somente server-side, com segredo em gestor de secrets, sandbox/fixtures, timeouts, orçamento e aprovação antes de qualquer endpoint pago. Ubersuggest: sem API oficial detectada; avaliar apenas OAuth/MCP oficial se o usuário configurar esse conector.

**Aceite:** 100% de chaves do escopo aprovado cobertas; placeholders preservados; revisão humana documentada; captura de textos longos e RTL; páginas SEO validam HTML SSR, canonical, hreflang e sitemap.

### Fase 6 — release e observabilidade

- Manter PR #125 em draft enquanto os gates obrigatórios não passarem; atualizar o PR em commits normais, sem force-push ou merge automático.
- Guardar screenshots, vídeos, JSON de métricas, fixtures, SHA, browser, viewport, hardware/backend e metodologia; nunca misturar baseline de outro SHA.
- Produzir relatório de riscos conhecidos incluindo advisory low sem fix upstream; manter regressão de segurança e auditoria de dependências.
- Ativar features online gradualmente por flag; desligar via rollback se houver fraude, erro de sincronização, aumento de 5xx, duplicação de resultado, erro de pagamentos ou regressão crítica de performance.

## 5. Teste ativo de segurança — limite obrigatório

Não executar “ataque de média intensidade” contra `jogomanager.com` nem backend/banco de produção: a instrução “parar quando começar a afetar” pode ser tardia e não define um limite seguro. Primeiro usar análise estática, testes unitários, fuzz controlado local e replay SQL em Postgres descartável. DAST só em **staging/preview isolado** que o usuário identifique e autorize, com dados sintéticos, zero pagamentos/e-mails reais, egress allowlist, no máximo 1 request/s, 500 requests ou 15 minutos, o que ocorrer primeiro; parar imediatamente em 5xx, chamadas externas, segredo/PII ou efeito sobre outro usuário. Requer URL de staging e autorização do alvo antes da execução.

## 6. Critérios de release e decisão de linguagem

- Não fazer merge enquanto o gate `Critical performance release gate` ou qualquer job obrigatório estiver vermelho, ausente, cancelado ou skipped. No HEAD auditado, a política Lighthouse é score ≥0,90, TBT ≤400 ms, LCP ≤2.700 ms, CLS ≤0,1 e acessibilidade ≥0,90 em três runs com agregação pessimista; essas condições substituem os thresholds históricos deste plano e estão registradas em `AGENTS.md`. Um check verde prova apenas a política ativa nesse SHA, não os thresholds históricos nem melhoria em hardware real.
- Preservar o comparador atual: até +400.000 bytes por representação do JavaScript agregado (raw, gzip-9, Brotli-Q6) e até +2.048 bytes por métrica gzip/Brotli de startup por rota; os budgets absolutos de `bundle:check` e limites específicos por rota continuam bloqueantes. Medir total emitido sem chamá-lo de download inicial.
- Não adicionar Go ou C#/.NET agora. Primeiro corrigir arquitetura, benchmarkar jogo completo e demonstrar ganho líquido em latência/custo/paridade. Se necessário, piloto Go atrás do contrato HTTP/HMAC já existente; nenhuma duplicação de regras autoritativas.
- Credenciais do preview, DataForSEO/Ubersuggest e ambiente DAST não estão disponíveis neste contexto; seus valores nunca devem ser enviados ao cliente ou incluídos no PR.

## 7. Evidência inicial e estado

- CI do SHA `4fc0edc`: build/types/tests e bundle passaram; Lighthouse mobile falhou por score 0,97 em `/melhores-formacoes` com mínimo 0,98.
- CI do SHA `8df72c0` (run `42424654927`): build/types/tests, stress de 200 partidas, startup bundle, benchmark/contratos 3D, auditoria de dependências, Supabase replay, shell Lighthouse e importer passaram. Lighthouse mobile falhou em score/TBT na home e em `/partida-rapida`; o gate crítico falhou. Check `evidence` ainda pendia na última leitura.
- CI do head documental `b72a2fd` (run `42426452442`): build/types/tests, stress, bundle de startup, replay Supabase, contratos 3D, auditoria de dependências, importer e demais checks listados no PR passaram; Lighthouse mobile e `Critical performance release gate` falharam; `evidence` estava pendente na última consulta. A falha impede promoção; não é corrigida por documentação.
- Reexecução do head `b8df3cb` (run `42428747855`, commit documental sem mudança de código): confirmou que 14 das 15 execuções móveis observadas passam os budgets de performance/TBT; uma execução da home marcou score 87 e TBT 459,1 ms, acima dos limites 0,97/200 ms. O job crítico concluiu `failure` por `lighthouse-mobile: failure`, conforme projetado. O job visual separado ainda estava em andamento; a análise das medições e a correção da interpretação do observador estão em [diagnóstico detalhado](ci-diagnosis-b8df3cb-2026-11-07.md).
- Snapshot corrente consultado em 2026-11-08: PR aberto/não merged, HEAD `6ad15e8ab7b56826044e4b77f801743017502e9a`; run `42459445389` de Quality gates concluiu `success`, incluindo Lighthouse mobile e `Critical performance release gate`. Os artefatos do run estão associados a esse SHA. Isso atualiza o status do CI, mas não equivale a aceitar todas as fases, testar produção ou certificar FPS em hardware físico. O CodSpeed separado está `neutral` e requer leitura das regressões reportadas.
- O relatório de bundle local disponível é anterior ao SHA e mede todos os chunks; serve como pista de diagnóstico, não como baseline aprovado.
- Foram concluídas 15 auditorias estáticas por domínio e 25 revisões técnicas adicionais, sintetizadas no [plano de implementação ampliado](mega-update-implementation-plan-2026-11-07.md) e no [índice detalhado das 15 auditorias](prior-static-audits-summary-2026-11-07.md). Ambas as rodadas foram somente leitura/pesquisa; não equivalem a testes de aceitação. O CI mais recente observado passou no HEAD indicado acima.
- Nenhuma migration, configuração Cloudflare, segredo, ferramenta paga ou endpoint de produção foi alterado nesta fase.


## 8. Estado do primeiro lote de estabilização (PR #125)

**Commit `8df72c0` publicado:** `.env.example` separa `VITE_SUPABASE_URL` da configuração server-side e remove duplicatas; o validador rejeita declarações repetidas ou ausentes; comparador permite no máximo +400.000 bytes agregados em raw, gzip-9 e Brotli-Q6, sem aumento no startup; seletor Match 3D ignora chunks auxiliares; piso de score mobile é 0,97.

**Verificado localmente no lote original:** lint; 1.714 testes em 327 arquivos; 21 testes de performance e quatro de ambiente público; build; `bundle-report --check`; TypeScript em checkout limpo com `npm ci` do lockfile (`stripe` 23.0.0). O `node_modules` preexistente tinha Stripe 23.1.0 e gerou dois erros de tipo em `apiVersion`; nenhum arquivo Stripe foi alterado. No CI histórico daquele lote, Lighthouse mobile falhou em score/TBT. Esse resultado é histórico; no HEAD `6ad15e8`, Quality gates e o agregador crítico passaram.

**Ainda pendente:** registrar baseline limpo ligado ao HEAD atual em desktop e 390×844; validar o preview com nomes públicos corretos sem exibir valores; investigar o outlier de TBT histórico sem atribuir causalidade não demonstrada; manter evidência visual associada ao SHA exato; obter staging e autorização específica antes de DAST; conectar DataForSEO apenas com credencial server-side, orçamento e necessidade editorial aprovados; receber/exportar CSV Ubersuggest (não há API/webhook oficial documentado). O gate Lighthouse atual passou sob thresholds ativos 0,90/400 ms/2.700 ms; a falha de `b8df3cb` não é bloqueio corrente.

## 9. Pesquisa técnica adicionada ao PR

O [adendo de pesquisa oficial](research-plan-addendum-2026-11-07.md) reúne 8 frentes e 75 referências primárias/oficiais, com critérios de aceite e perguntas que ainda precisam de benchmark/configuração real. A síntese recomenda:

- Autoridade por partida no backend, com Worker para autenticação/validação e um Durable Object por `matchId` para serializar intents; Supabase Realtime permanece transporte/presença, não autoridade de pontuação.
- Chat enviado/moderado server-side, membership verificada por RLS, canais privados, denúncias preservadas, apelação e ações graduais auditáveis.
- Para 3D: reuso de recursos, instancing/LOD, separar loop contínuo de telas estáticas e medir frame-time/memória/rede em dispositivos reais antes de elevar qualidade.
- TypeScript permanece base; Go/WASM, .NET/Blazor ou Rust só entram após prova de ganho completo de CPU versus custo de bytes, startup, memória e manutenção. A pesquisa não encontrou evidência suficiente para decidir adoção de Rust neste adendo.
- Internacionalização usa apenas locales realmente traduzidos e URLs próprias; canonical/hreflang/sitemap devem vir de inventário comum. DataForSEO seria server-side com orçamento e cache; Ubersuggest entra por CSV manual, pois a fonte oficial consultada não documenta API/webhooks.
- WCAG 2.2 AA é meta para fluxos completos; Core Web Vitals de campo devem ser avaliados no p75, sem confundir TBT de laboratório com INP de usuários reais.

Esse material é pesquisa e plano, não implementação dessas frentes. Não houve teste ativo no site, alteração de produção ou consumo de créditos DataForSEO/Ubersuggest. A fonte, versão e afirmação de cada referência estão no adendo.

## 10. Auditorias e aprofundamentos adicionados ao plano

A captura enviada mostra 15 auditorias já concluídas: CSS da carreira; telas e experiência da carreira; Stadium3D; outros monólitos; importer e limites; Firebase; crescimento/performance Supabase; backend/RLS; dependências/lockfiles; CDN/Cloudflare/headers; SEO técnico; email/webhooks/dados; tutorial; testes/evidência/release gates; e backlinks/segurança de domínio. Os identificadores, achados originais, limites de leitura estática e status de cada uma estão no [índice das 15 auditorias](prior-static-audits-summary-2026-11-07.md).

Para aprofundar esses achados, foram concluídas exatamente 25 revisões independentes e uma síntese, sem falhas de coleta. O [plano de implementação ampliado](mega-update-implementation-plan-2026-11-07.md) mapeia todas as 15 auditorias históricas e os 25 IDs novos, separa evidência atual/histórica/pendente, prioriza P0/P1/P2 e organiza dependências, lotes, critérios de aceitação, rollback, saves, acessibilidade e segurança. As revisões foram estáticas/documentais: não executaram testes, benchmarks, browser journeys, ataques ou chamadas pagas.

O perfil de backlinks continua bloqueado por falta de uma fonte confirmada e de dataset: não há classificação de links tóxicos nem arquivo/upload de disavow. A afirmação de 2026-11-07 de que o PR estava em draft por causa do gate Lighthouse/TBT é histórica: no snapshot de 2026-11-08, run `42459445389` e o gate crítico passaram no HEAD `6ad15e8`. O PR permanece em draft por critérios de aceitação das fases e evidências ainda pendentes, não por uma falha atual desse gate.
**Decisão de status (2026-11-08):** Fase 0 está parcialmente concluída e permanece pendente de baseline limpo desktop/390×844 e comprovação do preview/bundle no SHA candidato. O restante das Fases 1–6 permanece **pendente de conclusão e aceite**; isso não autoriza refazer itens já comprovados. As próximas ações são as não duplicadas descritas em `verification/pr125-mega-update/audit-2026-11-08.md`. Esta rodada é documental e não implementa novas etapas de jogo, banco ou produção.


## 11. Snapshot de auditoria — 2026-11-08

O snapshot público deste dia confirma PR #125 aberto e não merged na branch `codex/career-tutorial-css-20261107`, HEAD `6ad15e8ab7b56826044e4b77f801743017502e9a`. Quality gates run `42459445389`, Lighthouse mobile e `Critical performance release gate` concluíram `success`; o CodSpeed separado ficou `neutral` e reportou duas regressões que requerem análise. As falhas dos runs até `42428747855` continuam no histórico, mas não descrevem o status corrente.

A aprovação atual usa os thresholds ativos em `AGENTS.md` (score 0,90, TBT 400 ms, LCP 2.700 ms, CLS 0,1, acessibilidade 0,90; três runs e agregação pessimista). Ela não prova passagem pelos thresholds antigos, melhoria em dispositivo físico, implantação em produção ou aceite funcional das Fases 1–5. O PR continua em draft enquanto faltam evidências de baseline limpo e critérios de aceitação por fase; não manter a afirmação de que o gate Lighthouse atual está falhando.

A leitura fase a fase, os riscos de duplicação e o índice de nove categorias de evidência desta auditoria estão no relatório suplementar `verification/pr125-mega-update/audit-2026-11-08.md`; screenshots, vídeos e métricas versionados permanecem no diretório `verification/pr125-mega-update/`.
