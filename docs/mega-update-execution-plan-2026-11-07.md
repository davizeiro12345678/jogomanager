# Plano de execução — atualização online, 3D, UX e segurança

| Campo | Valor |
|---|---|
| Projeto | `davizeiro12345678/jogomanager` |
| PR | [#125](https://github.com/davizeiro12345678/jogomanager/pull/125) |
| Branch/SHA inspecionados | `codex/career-tutorial-css-20261107` / `4fc0edcde9b3968fc1606d087c5ddbadbb016b76` |
| Situação inicial | PR em draft; build, testes e bundle aprovados; Lighthouse mobile reprovou `/melhores-formacoes` (0,97 vs. mínimo 0,98). |
| Método | 14 auditorias independentes; sem alteração em banco/produção e sem teste ofensivo ativo. |

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
8. **Performance:** o CI do SHA `4fc0edc` falhou somente porque `/melhores-formacoes` teve score mobile 0,97; o limite configurado é 0,98 com agregação pessimista. LCP, CLS e TBT continuam como limites independentes e não devem ser desativados.
9. **C#/.NET e Go:** manter TypeScript como fonte canônica de simulação e servidor; manter Rust/WASM restrito aos kernels isolados existentes. O piloto disponível de Go foi mais lento que TypeScript após a fronteira, e C#/.NET no browser aumenta startup/tamanho. Só reabrir a decisão com benchmark full-match e benefício operacional medido.
10. **SEO:** o site tem canonical, sitemap/robots e allowlist pública, mas não tem hreflang nem páginas editoriais localizadas. Não há integração DataForSEO/Ubersuggest no repositório. DataForSEO pode ser adicionado server-side após conectar credenciais e aprovar orçamento; a documentação oficial consultada informa que Ubersuggest não oferece API/webhooks, somente uma opção de MCP/OAuth não configurada.
11. **Risco operacional:** duas árvores de migração aparecem no repositório; a autoridade de qual delas é aplicada precisa ser unificada e verificada em replay descartável. Nenhuma migration será aplicada ao projeto hospedado durante esta fase.

## 4. Fases e entregáveis

### Fase 0 — estabilização e linha de base

- Corrigir `.env.example`/validador para declarar e exigir os nomes públicos e server-side corretos, rejeitar declarações duplicadas e impedir que `service_role` apareça no bundle público. Não incluir valores de chaves.
- Reproduzir a validação no preview local com o contrato de configuração conhecido; melhorar o diagnóstico para dizer **qual nome** está ausente, sem imprimir valor.
- Corrigir o seletor do bundle Match 3D e adicionar fixtures em que chunks auxiliares `match-*` aparecem antes da rota real.
- Atualizar o budget de bundle solicitado pelo usuário para permitir crescimento total de até **400.000 bytes** por comparação, com escopo/métrica escritos no artefato; manter budgets por rota de startup e medir gzip/Brotli separadamente. A unidade final proposta deve ser confirmada antes de editar o gate (ver perguntas no fim).
- Ajustar, se aprovado, somente o mínimo do score Lighthouse mobile de **0,98 para 0,97**, porque o run atual reprovou em 0,97. Manter 3 runs, agregação pessimista, accessibility e os limites absolutos de LCP ≤ 2.500 ms, CLS ≤ 0,1 e TBT ≤ 200 ms. A mudança é alteração explícita de política, não supressão de job.
- Capturar baseline limpo do SHA exato em preview local, em 390×844 e desktop, sem usar screenshot com overlays do inspector.

**Aceite:** testes do validador e do comparador passam; serviço/preview inicia com nomes públicos corretos; bundle público não contém segredo; todos os budgets absolutos continuam ativos; build e CI do SHA final publicados. Nenhum teste neste documento é considerado concluído até executar.

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

- Não fazer merge enquanto o gate `Critical performance release gate` ou qualquer job obrigatório estiver vermelho. O único relaxamento proposto de Lighthouse é score 0,98→0,97; LCP/CLS/TBT, acessibilidade, número de runs e agregação pessimista permanecem.
- A permissão de +400 KB proposta não se aplica à closure de startup de cada rota; preservar o orçamento específico e medir total emitido, gzip e Brotli sem chamar o total de um download inicial.
- Não adicionar Go ou C#/.NET agora. Primeiro corrigir arquitetura, benchmarkar jogo completo e demonstrar ganho líquido em latência/custo/paridade. Se necessário, piloto Go atrás do contrato HTTP/HMAC já existente; nenhuma duplicação de regras autoritativas.
- Credenciais do preview, DataForSEO/Ubersuggest e ambiente DAST não estão disponíveis neste contexto; seus valores nunca devem ser enviados ao cliente ou incluídos no PR.

## 7. Evidência inicial e estado

- CI do SHA `4fc0edc`: build/types/tests e bundle passaram; Lighthouse mobile falhou por score 0,97 em `/melhores-formacoes` com mínimo 0,98; o agregador falhou por essa dependência.
- O relatório de bundle local disponível é anterior ao SHA e mede todos os chunks; serve como pista de diagnóstico, não como baseline aprovado.
- Auditorias direcionadas já executadas por agentes encontraram testes específicos de multiplayer, carreira e i18n; a suíte completa e CI precisam ser repetidos no SHA final do Node/lockfile declarados pelo projeto.
- Nenhuma migration, configuração Cloudflare, segredo, ferramenta paga ou endpoint de produção foi alterado nesta fase.


## 8. Estado do primeiro lote de estabilização (local)

**Implementado na árvore local, ainda não publicado neste registro:** `.env.example` agora separa `VITE_SUPABASE_URL` da configuração server-side, remove duplicatas e o validador rejeita nomes repetidos e declarações ausentes; o teste correspondente tem quatro casos. O comparador permite no máximo +400.000 bytes por cada métrica total (raw, gzip-9 e Brotli-Q6), mas não permite aumento na inicialização de rotas; a rota Match 3D exclui chunks auxiliares. O score mínimo mobile foi ajustado de 0,98 para 0,97, mantendo acessibilidade, três medições e os limites absolutos LCP/CLS/TBT.

**Verificado localmente:** lint aprovado; 1.714 testes em 327 arquivos aprovados; 21 testes de performance e quatro de variáveis públicos aprovados; validador do template aprovado; build de produção aprovado; `bundle-report --check` aprovado em diretório temporário; TypeScript aprovado num checkout limpo com `npm ci` do lockfile (`stripe` 23.0.0). O `node_modules` preexistente do sandbox tinha Stripe 23.1.0 e, por isso, gerou dois erros de tipo de `apiVersion`; nenhum arquivo Stripe foi alterado. O gate de performance ainda deve ser confirmado pelo CI remoto no novo SHA.

**Ainda pendente:** publicar o lote; executar CI remoto e revisar artefatos; verificar as variáveis reais da preview sem exibir/chutar valores; capturar screenshots limpos antes/depois da mudança visual; obter confirmação da direção de redesign antes de alterar a UI; obter URL e autorização de staging para qualquer DAST; conectar DataForSEO/Ubersuggest sem compartilhar tokens no chat.
