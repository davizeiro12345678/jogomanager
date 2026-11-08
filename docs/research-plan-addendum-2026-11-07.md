# Adendo ao plano de execução — JogoManager PR #125

**Repositório/PR:** `davizeiro12345678/jogomanager`, PR #125
**Data do snapshot:** 2026-11-07
**SHA observado:** `8df72c0`

## Estado observado no snapshot consultado

O PR #125 permanece **aberto e em draft** no SHA `8df72c0`. Foram reportados como **pass** os checks de build, types e tests; o stress de 200 partidas; o bundle; o benchmark 3D; a auditoria de dependências; o replay do Supabase; o shell Lighthouse; e os contratos do worker. **Lighthouse mobile** e **gate crítico** foram reportados como **fail**. A evidência estava **pending** no snapshot consultado. Este adendo não transforma esses resultados em uma aprovação do CI inteiro e não afirma que o PR foi mergeado.

**Falhas e pendências de validação:** a lista de falhas de pesquisa fornecida foi vazia (`Falhas: []`). Ainda assim, a validação do PR tem duas frentes explicitamente falhas — Lighthouse mobile e gate crítico — e uma pendência explícita — evidence. O estado atual do repositório, os números reais de desempenho, o schema efetivo e o deploy não foram inspecionados nesta pesquisa; as conclusões abaixo são plano e critérios de execução, não testes adicionais.

## Decisão executiva

1. **Não confiar no navegador.** O bundle Vite, o estado TanStack, o canvas/3D, o cliente Supabase e qualquer mensagem enviada pelo browser devem ser tratados como entrada não confiável. O WebSocket usa um modelo de segurança baseado em origem para um cliente que executa código não confiável; WebSocket também não fornece autenticação embutida. [1] [2]
2. **Colocar a autoridade por partida no backend.** O Worker deve autenticar, validar e rotear; um `GameMatch` Durable Object deve serializar intents e ser o único escritor/decisor do estado da partida. Durable Objects são globais por nome e single-threaded para coordenação stateful, e a recomendação documentada é modelar a unidade lógica — neste caso, uma partida — em vez de um objeto global. [3] [4] [5]
3. **Manter TypeScript/Vite/TanStack como padrão.** Go/WASM pode ser um módulo isolado para simulação determinística, replay ou cálculo visual quando o benchmark justificar. Blazor/.NET não deve substituir a aplicação inteira sem prova de payload, cold start, memória e CPU. Rust/WASM não possui evidência documental no conjunto fornecido; portanto, nenhuma decisão favorável a Rust pode ser tomada neste adendo.
4. **Resolver primeiro segurança, persistência e bloqueios de qualidade.** O gate crítico e o Lighthouse mobile devem ser corrigidos antes de considerar expansão funcional, SEO automatizado ou uma migração de linguagem. O resultado de uma partida deve ser calculado e persistido pelo backend, não aceito como payload de vitória vindo do browser. [6] [7] [8]

## Recomendações por frente

### 1. Multiplayer autoritativo, sessão e anti-abuso

#### Decisões

- No handshake, o Worker deve aceitar somente `GET` com `Upgrade: websocket`, validar `Origin` contra uma allowlist exata e exigir autenticação inicial. A orientação de segurança para WebSocket recomenda WSS, allowlist de `Origin`, autenticação de sessão, autorização em cada ação, validação de todas as mensagens, limites de tamanho e frequência, heartbeat/timeout e proteção contra replay. [2]
- Roteie deterministicamente cada `matchId` para `idFromName(matchId)`/`getByName(matchId)` de um `GameMatch` Durable Object. Não use um DO global. O Worker faz autenticação, validação e formatação; o DO executa a lógica stateful e coordena os clientes da partida. [4] [5]
- Defina um contrato discriminado mínimo, por exemplo `ClientIntent = { action, clientSeq, ...params }`. Rejeite campos desconhecidos, `NaN`, `Infinity`, vetores fora do domínio, `matchId` divergente da rota e payloads acima de um limite baixo definido pelo produto. Nunca aceite do cliente `score`, `winner`, posição final, delta de tempo, saldo, cooldown concluído ou seed/RNG autoritativo. Tipagem TypeScript isolada não valida dados em runtime. [31]
- Associe a conexão ao `sub` autenticado, não a um `playerId` fornecido no payload. Autorize cada intent pelo usuário, pela fase da partida e pelo estado atual. Use `clientSeq` monotônico por conexão/jogador, rejeite duplicatas e mantenha uma janela de nonce/replay; o tick e o timestamp de autoridade devem vir do servidor. [2] [6]
- Aceite uma mensagem inicial de autenticação sobre WSS ou um ticket curto, de uso único, emitido por endpoint HTTPS autenticado. Até a validação, não envie dados protegidos e feche conexões que não autentiquem dentro de timeout. Não coloque token em query string nem em logs; valide `iss`, `aud`, `sub`, `exp` e assinatura via biblioteca/JWKS quando aplicável. `exp` limita a validade do JWT e Supabase recomenda biblioteca de verificação para tokens assimétricos. [2] [6]
- Execute simulação determinística em ticks definidos pelo servidor. Envie snapshots ou deltas versionados com `serverTick`, estado autoritativo e acknowledgements. Prediction/interpolation no cliente é apenas renderização; toda divergência deve reconciliar com o snapshot do servidor. [3] [4]
- Use armazenamento SQLite-backed do Durable Object para checkpoint, fase, jogadores, último `clientSeq`, eventos essenciais e resultado idempotente. Use attachments apenas para pequenos dados por conexão, como `userId`, `matchId` e último sequence; o limite documentado do attachment é 16.384 bytes, e estado de partida maior deve ficar em armazenamento persistente. [4]
- Avalie Hibernation para lobby, espera e baixa atividade. Uma partida com tick contínuo precisa de benchmark próprio: a Hibernation WebSocket API preserva conexões, mas o objeto pode ser reconstruído e o estado em memória é perdido; callbacks/alarmes e simulação ativa podem impedir o perfil de economia esperado. [4]
- O cliente deve reconectar com backoff, pedir snapshot/resume e nunca reenviar estado final calculado localmente. O runtime documenta limite de 32 MiB por mensagem e interrupções durante atualização, crash ou shutdown; isso não deve ser usado como limite de produto, que deve ser muito menor. [3]

#### Limites seguros e validação

Adote dois níveis de limitação: regras Cloudflare para login, criação/join e upgrade HTTP; e token bucket dentro do `GameMatch` por usuário/conexão para intents, tamanho, mensagens por janela, conexões e fila/backpressure. Rate limiting HTTP da Cloudflare pode ter atraso de alguns segundos e não substitui o controle de frames em uma conexão já aberta. [9] [2]

Os números definitivos de tick rate, intents por jogador/segundo, tamanho de payload, snapshots, espectadores e fila não podem ser inventados a partir da documentação. Fixe-os depois de carga representativa, medindo p50/p95/p99, jitter, CPU/duração, mensagens descartadas, reconnects e custo por partida. O limite do runtime é uma proteção operacional, não um orçamento de jogo. [3] [9]

Registre eventos estruturados de conexão, autenticação, falha de schema, replay, autorização, rate limit, desconexão e resultado com `matchId`, identificador interno/anonimizado, `serverTick` e `reasonCode`. Não registre token, session ID nem payload completo. Mantenha digest/replay do servidor para investigação; banimento automático e assinatura de cada replay são hipóteses de produto, não conclusões da evidência.

#### Critérios de aceite

- Um intent adulterado de score, vitória, saldo, posição final, cooldown ou RNG nunca altera o resultado persistido.
- Replay do mesmo `clientSeq` é idempotentemente rejeitado; intent de outro jogador, sala não autorizada, JWT expirado, Origin inválida, schema inválido, flood e payload grande são rejeitados sem afetar os demais.
- Reconnect durante snapshot, restart/upgrade, eviction, crash e duas ações concorrentes são testados antes do release; esses testes são plano, não foram executados nesta pesquisa.
- A única fonte do resultado final é o estado produzido pelo DO e gravado pelo backend.

### 2. Chat privado, denúncias e moderação

#### Decisões

Modele `conversations`, `conversation_members`, `chat_messages`, `blocks`, `reports` e `moderation_actions`. Derive o usuário de `auth.uid()`/JWT; não aceite `sender_id`, membership, status, sanção ou `moderation_state` enviados pelo cliente. Tabelas expostas exigem RLS e grants mínimos; adicionar policy não remove grants existentes, e `service_role` ignora RLS e deve permanecer server-side. [8] [39]

Para cada DM, use tópico derivado de `conversation_id`, `private=true` e `Allow public access` desabilitado. As policies de `realtime.messages` devem testar membership pelo tópico e separar leitura de escrita. Canal privado controla assinatura, mas não equivale a criptografia ponta a ponta nem, sozinho, impede leitura direta indevida no banco. [7] [11]

Use um único endpoint server-side, como `chat-send` em Edge Function com `auth=user` ou Worker que valide o JWT. Valide schema e UTF-8 no servidor, imponha tamanho em bytes, normalize o texto, exija `client_message_id`/nonce único, verifique membership e block e grave em transação. O modo `auth=user` deixa o cliente limitado às policies do chamador; o cliente administrativo ignora RLS e exige filtros explícitos. [12]

Persistir a decisão como `visible`, `held`, `rejected` ou `removed`, com `reason_code` e timestamps; publicar somente depois do commit, com payload sanitizado. O TanStack Query pode manter uma linha otimista `pending`, mas a resposta confirmada substitui essa linha e eventos recebidos devem ser validados novamente antes de atualizar o cache. [11] [32] [33]

Renderize o corpo como texto; use escaping/allowlist de links e rejeite protocolos perigosos. Ofereça bloquear, silenciar, denunciar e contestar sanção. Use uma escada reversível e auditável — aviso, mute temporário, bloqueio de DM, suspensão temporária e banimento — sem afirmar que qualquer limiar automático seja validado pelas fontes.

Aplique finalidade, necessidade, segurança, prevenção, transparência e responsabilização a mensagens, denúncias, identificadores e logs quando forem dados pessoais. Medidas técnicas e administrativas devem existir desde a concepção do produto. [15]

#### Limites seguros

Imponha limites por usuário e conversa, conexões, payload, frequência, backoff, deduplicação, cooldown para primeiro DM/contas novas e filtros de spam/links/termos configuráveis. Se um limite global estrito for requisito, use Durable Object por `userId` ou `conversationId`; se rate limiting aproximado por localidade for aceitável, use binding Cloudflare, mas meça excedentes. O binding é aproximado, eventualmente consistente e separado por localidade; IP não deve ser o único identificador. [9]

Use Turnstile apenas em operações configuráveis de risco — criação de conta, primeiro contato, repetição suspeita ou muitos reports — e não como autorização nem como desafio por mensagem. A validação server-side é obrigatória; o token vale 300 segundos, é de uso único e replay retorna `timeout-or-duplicate`; valide também `action` e `hostname` e mantenha o segredo fora de `VITE_*`. [14] [50]

O acesso Realtime fica em cache durante a conexão. Remover membership, block ou ban não necessariamente encerra imediatamente uma conexão ativa; defina TTL curto de JWT e uma estratégia explícita de refresh/rejoin/fechamento. [7]

### 3. Supabase, RLS, Realtime e crescimento do Postgres

#### Decisões

Para cada tabela exposta, crie migration reproduzível que habilite RLS, revogue grants desnecessários, conceda somente operações necessárias e crie policy separada para `SELECT`, `INSERT`, `UPDATE` e `DELETE`. Em `INSERT`, use `WITH CHECK`; em `UPDATE`, valide `USING` e `WITH CHECK`; derive proprietário com `auth.uid()` em vez de aceitar `user_id`. RLS sem policy aplicável segue default-deny, mas owner, superuser e papéis `BYPASSRLS` são exceções relevantes; policies permissivas combinam-se por OR por padrão. [73] [8]

Pontuação, resultado, transição de estado, saldo, autoria e timestamps devem ser autoritativos no Postgres ou em endpoint/DO que execute transação estreita. Prefira RPC allow-listed ou Worker que valide JWT, estado anterior, transição, versão e idempotência. RLS é barreira de acesso a linhas; não substitui validação das invariantes do domínio.

Modele uma tabela de membership indexada, como `match_members(match_id, user_id)`, e autorize o tópico canônico com `EXISTS`. Use Postgres Changes para mudanças duráveis e baixo/médio fan-out que o cliente deve reconciliar com linhas do banco; use Broadcast para presença, animação, chat e telemetria efêmera. Postgres Changes exige publicação `supabase_realtime`, pode filtrar tabela/evento/colunas e tem semântica específica para DELETE; RLS não é aplicada a eventos DELETE como é para leitura dos registros. [68]

A documentação alerta que cada evento Postgres Changes é autorizado contra cada assinante e que a ordenação usa uma única thread; o próprio material recomenda considerar Broadcast acima de aproximadamente 3.000 assinantes concorrentes na mesma mudança. Esse número não é SLO do projeto: plano, cardinalidade, payload e benchmark real são determinantes. [68] [69]

Indexe primeiro colunas usadas por RLS e joins de membership, depois confirme com `EXPLAIN`/`EXPLAIN ANALYZE` em ambiente seguro. Índices aceleram leituras, mas aumentam armazenamento e custo de escrita; considere índices parciais para estados ativos e BRIN para colunas monotônicas somente após observar o workload. [71] [72]

Acompanhe autovacuum, dead tuples/bloat, estatísticas, WAL/replication lag, locks, p95/p99 de queries, conexões e sessões `idle in transaction`. VACUUM comum mantém espaço reutilizável, estatísticas e proteção contra transaction-ID wraparound; VACUUM FULL bloqueia a tabela e não deve ser rotina de crescimento. [74]

Dimensione Supavisor/PgBouncer em relação a Database Max Connections e ao uso de PostgREST, Auth, Realtime, jobs e Worker; observe `pg_stat_activity` e os gráficos do projeto. Não abra conexão direta por request nem deduza capacidade apenas do número de WebSockets. [75]

#### Critérios de aceite

- Testes pgTAP ou equivalentes comprovam allow/deny para `anon`, `authenticated`, proprietário, não membro e cada operação.
- Nenhuma view, função `security definer`, grant herdado ou migration ampla reabre acesso depois da policy específica.
- Reconnect sempre executa ressincronização; eventos têm deduplicação por id/versão e o frontend invalida/refaz queries relevantes.
- Resultado final é idempotente e não depende de `Broadcast` emitido diretamente pelo navegador.

### 4. Estádio 3D, bundle e experiência mobile

A arquitetura recomendada para o asset é glTF/GLB com nós semânticos e origem/escala planejadas. Casco, gramado, cobertura e arquibancadas estáticas podem ser mesclados por material; assentos, refletores, placas e elementos repetitivos devem preferir `InstancedMesh`; jogadores, bola, placar e elementos interativos permanecem separados. Mesclar geometrias reduz operações de desenho, mas remove a facilidade de mover cada parte individualmente. [18] [20]

No R3F, reutilize geometria, material e textura; carregue com `useLoader`/`useGLTF` em URL estável, aproveitando cache. Evite montar/desmontar grandes subárvores em toda troca de tela. Instancing e LOD reduzem draw calls/vértices; a orientação documentada de no máximo 1.000 draw calls, idealmente algumas centenas ou menos, é heurística e não contrato universal de FPS. [16] [17]

Separe a política de loop: `frameloop="demand"` para lobby, inspeção e estádio estático; loop contínuo somente durante animação real, replay ou partida. Mutações imperativas, controles, resize e carregamento precisam chamar `invalidate` no modo sob demanda. [17] [19]

Atualize jogadores, bola e câmera em `useFrame` com refs, `delta` e objetos temporários reutilizados. Não envie posição para `setState`, store reativo ou TanStack Query a cada frame. React/TanStack deve cuidar de tela, snapshots e comandos de baixa frequência; transformações ficam nos objetos Three.js. [16]

Implemente LOD progressivo e comece a multidão com instâncias ou billboards; modelos detalhados só em proximidade. Adote adaptação de qualidade medida, reduzindo DPR, texturas, sombras e pós-processamento quando necessário e restaurando gradualmente. Os valores de DPR, qualidade e contagens precisam vir do benchmark, não de uma heurística copiada.

No Vite, prefira importar GLB, texturas e LODs para URLs de produção hashadas; use `public` somente quando o nome/URL estável for realmente necessário. Se Static Assets do Workers for o caminho de deploy, valide o limite efetivo do plano; a documentação lista 25 MiB por arquivo nesse contexto, mas o plano efetivo não foi confirmado. [23] [22]

Não use variável global de módulo do Worker para estado de partida. Workers executam em isolates e requisições podem cair em instâncias diferentes; estado global não é uma autoridade confiável. [21]

O benchmark obrigatório deve cobrir build de produção, carregamento frio/quente, câmera interna/externa, viewport representativo, DPR baixo/alto, mobile com GPU integrada e desktop, e combinações com jogadores, crowd, luzes, sombras e pós-processamento. Registre FPS médio e piores frames, draw calls, triângulos, frame time CPU/GPU, memória/texturas, bytes transferidos, parse/decode e long tasks.

### 5. Acessibilidade, Lighthouse mobile e Core Web Vitals

A meta deve ser **WCAG 2.2 AA** para a página inteira e para o fluxo completo: entrada/login, lobby, criação/entrada, gameplay, resultado, leaderboard e configurações. WCAG define princípios perceptível, operável, compreensível e robusto, com critérios testáveis; conformidade AA inclui todos os critérios A e AA aplicáveis, e testes automáticos sozinhos não comprovam conformidade. [51] [52]

Toda funcionalidade deve ser operável por teclado, sem depender de uma sequência de teclas em tempo apertado. Use elementos HTML semânticos para menus, botões, diálogos, inventário, placar e ações discretas; ofereça equivalente de teclado para arrastar/apontar quando a trajetória não for essencial. [53]

Preserve ordem de foco, use `:focus-visible` contrastante, evite que overlays escondam totalmente o foco e reserve espaço para HUD/rodapé. Alvos de ponteiro devem ter pelo menos 24×24 CSS px, salvo exceções documentadas; texto normal precisa de contraste mínimo 4,5:1 e texto grande 3:1. Não comunique estado somente por cor. [54] [55] [56] [57]

Coloque resultado de jogada, salvamento, carregamento, reconexão e erro em regiões `role="status"`/`role="alert"` apropriadas, determináveis programaticamente sem mover foco para cada toast. [58]

O conjunto atual de Core Web Vitals é LCP, INP e CLS; os limiares de experiência boa são LCP ≤ 2,5 s, INP ≤ 200 ms e CLS ≤ 0,1, avaliados no p75 e separados entre mobile e desktop. O gate de Lighthouse mobile que já falhou deve ser tratado como bloqueador até haver evidência reproduzível de correção. [59]

Para LCP, entregue HTML/CSS inicial útil e torne o elemento principal descobrível cedo; não espere dados opcionais do Supabase para o shell. Para CLS, reserve dimensões para canvas, imagens, fontes, placar, banners e painéis tardios; prefira `transform` a `top/left` em animações sem reflow. Para INP, mantenha handlers curtos, faça primeiro a atualização visual necessária, postergue serialização/telemetria e divida tarefas longas. [62] [63] [64]

Use RUM assíncrono com `web-vitals`, `sendBeacon` e fallback `fetch keepalive`; agregue p75 por mobile/desktop/rota e observe p90/p95. Registre versão do deploy e dados minimizados, sem estado de jogo, tokens ou PII. Dados de campo representam usuários reais; laboratório é útil para CI, mas não substitui campo, não mede INP sem interação e pode subestimar CLS de vida inteira. [60]

Para a SPA, instrumente carregamentos completos e transições. As APIs de soft navigation dependem de suporte do navegador e versão da biblioteca; mantenha métrica própria de tempo até conteúdo/jogada nos demais motores. [61]

**Entrega segura da correção:** reproduzir Lighthouse mobile com build de produção, documentar CPU, viewport, rede, navegador e cache, comparar múltiplas execuções e guardar LCP/CLS/TBT e score. Complementar com fluxo real de jogo, teste manual de teclado/leitor de tela/zoom e teste de contraste nas cenas finais. Não declarar o gate corrigido sem evidência anexada.

### 6. Internacionalização e SEO público

Para idiomas diferentes, use URLs distintas por idioma, preferencialmente subdiretórios estáveis como `/pt-br/`, `/en/` e `/es/` apenas se forem requisitos reais. Google recomenda URLs distintas em vez de cookies/configuração do navegador e alerta que redirecionamento dinâmico pode impedir descoberta porque Googlebot normalmente não envia `Accept-Language`. [34] [35]

Modele locale como segmento de rota no TanStack Router e gere navegação com `<a href>`. Para cada página pública, gere deterministicamente title, description, canonical, alternates hreflang, `og:locale`, `html lang` e direção. Cada variante aponta para si e para as demais, com URLs absolutas HTTPS e `x-default` para seletora/fallback; links devem ser recíprocos. [34] [36]

Use canonical auto-referente na própria variante traduzida; não aponte todas as línguas para uma canonical inglesa. Redirects e `rel=canonical` são sinais fortes, enquanto sitemap é sinal fraco. [37]

Prefira pré-renderização por locale ou SSR/HTML transform no Worker para páginas públicas indexáveis, colocando conteúdo principal, H1, title, description, canonical, hreflang e links no HTML inicial. Google processa JavaScript, mas pré-render/SSR melhora velocidade e alcança bots que não executam JavaScript; rotas inexistentes devem responder 404 real ou noindex, não shell 200. [36]

Separe público de autenticado/personalizado. Dashboard, partidas privadas e rotas sem valor de busca devem ter `noindex` desde a origem e não entrar no sitemap. A chave de cache padrão inclui entrypoint, caminho e query, mas não inclui normalmente `Accept-Language`, Cookie, Authorization ou User-Agent; portanto, HTML localizado deve ser particionado pela URL e não por header/cookie sem chave correspondente. [38]

Defina `html lang` como tag BCP 47 válida, `dir` conforme o locale, propriedades CSS lógicas, pluralização e formatação local. O Google documenta um subconjunto de idioma/região para hreflang; não invente locales, regiões ou slugs para preencher tags. [34] [35]

### 7. DataForSEO, Ubersuggest e critério de uso

#### Decisão

**DataForSEO:** automatizar somente por fronteira server-side. O navegador chama uma rota própria do Worker/Edge Function; essa função chama DataForSEO usando HTTP Basic Authentication em secret binding. Não enviar login/API password ao bundle Vite, localStorage, cliente ou URL; Cloudflare recomenda Secrets criptografados para API keys/tokens e Supabase mantém secrets/service keys no backend. [43] [49] [50]

Expor no máximo endpoints internos como `POST /api/seo/keyword-suggestions` e `POST /api/seo/keyword-overview`. Validar no servidor seed/keywords, location, language, limit, cursor e flags permitidas; rejeitar campos desconhecidos, URL de provedor e opções arbitrárias. `Suggestions` retorna consultas que incluem a seed e métricas como volume mensal, tendência, CPC e competition; `Overview` oferece volume, intenção, CPC, competition, SERP e backlinks, exige localização/idioma e aceita até 700 keywords por task conforme a documentação consultada. [41] [42]

Use pipeline em duas etapas: Suggestions para long-tails; Overview apenas para shortlist. `include_clickstream_data` fica desligado por padrão e só é habilitado por opt-in/orçamento, pois a documentação informa que ele dobra a cobrança da requisição. As métricas devem manter nomes não ambíguos: `paid_competition`/`cpc`, `organic_keyword_difficulty` e `search_volume_estimate`. Competition de anúncios não é dificuldade orgânica; keyword difficulty é escala relativa de 0 a 100 para entrada no top 10 orgânico, e search volume é aproximado. [42] [44]

Use cache server-side por chave normalizada, TTL configurável, deduplicação de requests em voo e DTO com proveniência, `fetched_at`, locale, endpoint, versão da resposta, custo reportado e datas de atualização. TanStack Query pode melhorar a UX, mas não controla orçamento nem substitui o limite no Worker. A DataForSEO documenta cobrança por request, até 2.000 chamadas/minuto e no máximo 30 simultâneas para Suggestions; esses são limites do fornecedor, não quota segura do produto. [41]

**Ubersuggest:** tratar como importação manual, não como adapter HTTP. A fonte oficial informa que não há API nem webhooks; o PRO permite exportar CSV de Keyword Ideas e resultados/métricas, e a tela de Keyword Ideas aceita keyword, localização, idioma, filtros e exportação. [45] [46] [47]

A importação deve validar tipo, tamanho, encoding, cabeçalhos, localização, idioma, data e `source_file_hash`, guardar `provider=ubersuggest` e aceitar mudanças toleráveis de colunas. Não fazer scraping, automação de sessão ou chamadas de endpoints privados. Os limites da conta gratuita — inclusive 3 buscas/relatórios por dia — não são contrato de API para o jogo e não devem ser usados como quota de integração. [48]

#### Critério de ativação e limites seguros

Ative a frente somente se houver uma necessidade editorial concreta — páginas públicas de jogos, ligas, times, notícias ou guias — e um responsável que aceite orçamento, retenção e termos de redistribuição. Não exponha a funcionalidade como proxy público ilimitado. Separe credencial administrativa da experiência pública do jogador; rate-limit por usuário/projeto/IP, imponha limite de tamanho de CSV e número de keywords, exija idempotency key e retorne apenas DTO normalizado com `request_id`.

Os limites internos devem ser deliberadamente menores que os máximos do provedor e fixados depois de medir p95, timeouts, `tasks_error`, custo e cache hit; não há base estruturada para inventar números de produto neste adendo. Se não houver orçamento, credencial e necessidade editorial, adie a frente e use somente o fluxo manual de importação Ubersuggest.

### 8. Go, .NET, TypeScript, Rust e WASM

#### Decisão recomendada

- **TypeScript/Vite/TanStack — escolha padrão:** manter UI, orquestração, autenticação de sessão, transporte e integração. Tipos ajudam no desenvolvimento, mas são apagados em runtime e não validam JSON/comandos/resultados externos. [31]
- **Go/WASM — opção isolada e condicional:** usar apenas para simulação determinística opcional, replay local, previsão otimista ou cálculo visual CPU-intensivo. O alvo de navegador usa `GOOS=js`/`GOARCH=wasm`, exige `wasm_exec.js` compatível com a mesma versão major e entrypoint `main`; fixar essa versão no CI. [24]
- **.NET/Blazor — não migrar a aplicação inteira:** Blazor baixa runtime .NET, componentes e dependências ao browser; o código enviado pode ser inspecionado/adulterado e o payload é maior. AOT pode acelerar tarefas CPU-intensivas, mas a documentação informa que muitos apps AOT ficam aproximadamente duas vezes maiores que os interpretados em IL. Usar apenas em protótipo/rota isolada ou backend, condicionado a benchmark. [25] [26]
- **WASM no Worker — apenas funções puras e ABI pequena:** Cloudflare documenta importação de módulo pré-compilado e `WebAssembly.instantiate`, recomenda instanciar no escopo do módulo quando a instância for imutável/reentrante e não suporta `instantiateStreaming`. Não guardar estado de partida, usuário ou pedido em memória global. [28] [29] [30]
- **Go browser WASM não é automaticamente o módulo do Worker:** validar em protótipo alvo/ABI compatível; a documentação consultada não prova interoperabilidade direta entre o artefato `GOOS=js` do navegador e o runtime do Worker. Para .NET no Worker, tratar runtime completo como hipótese de alto risco até confirmar APIs, tamanho e startup. [24] [28] [30]
- **Rust/WASM — frente sem evidência fornecida:** os resultados estruturados não incluem documentação, benchmark ou integração Rust. Não recomendar migração para Rust nem alegar vantagem de performance, payload, compatibilidade ou segurança. Se for necessário comparar depois, usar o mesmo contrato, fixtures, ABI e benchmark de TypeScript e Go, registrando o resultado como nova evidência antes de decidir.

Qualquer cálculo enviado ao browser — TypeScript, Go, .NET ou Rust/WASM — pode ser lido, instrumentado e alterado pelo jogador. WebAssembly importa capacidades do host e segue as restrições do JavaScript fora disso; é sandbox de execução, não fronteira de confiança contra o próprio navegador. A autoridade permanece no Worker/DO/Postgres. [27] [31]

Mantenha contrato de protocolo independente da linguagem: versão, tipos numéricos, unidades, seed/RNG, erros, limites e idempotência. Se mais de uma implementação calcular o mesmo resultado, compartilhe fixtures e prefira inteiros/fixed-point quando a regra exigir reprodutibilidade; não assuma equivalência byte a byte de floats entre runtimes.

#### Gate de benchmark para qualquer WASM

Antes de incluir Go/.NET/Rust/WASM no bundle principal, medir em desktop e celulares-alvo bytes comprimidos, tempo até interação, cold start, memória, throughput, serialização JS↔WASM, p95 de latência e impacto no LCP/INP. O módulo deve ser lazy-loaded, ter orçamento de bytes e não bloquear o caminho inicial. Sem ganho mensurável que compense complexidade e payload, permanecer em TypeScript.

## Priorização e fases

### Fase 0 — desbloqueio e evidência do PR

1. Preservar o estado observado: SHA `8df72c0`, PR aberto/draft, checks individuais reportados como pass, Lighthouse mobile/gate crítico fail e evidence pending.
2. Reproduzir o Lighthouse mobile e o gate crítico com build de produção, guardar artefatos e corrigir sem afirmar aprovação do CI inteiro.
3. Definir o que a evidência pending precisa conter: logs, relatório, screenshot/trace, ambiente, commit e timestamp. Esta pesquisa não executou nem completou esse material.
4. Mapear deploy efetivo, plano Cloudflare/Supabase, rotas, tabelas, grants, policies, Worker/Edge Functions e versões instaladas antes de alterações de schema ou runtime.

### Fase 1 — autoridade, autenticação e banco seguro

1. Implementar Worker + `GameMatch` DO por `matchId`, intents versionados, schema runtime, `clientSeq`, replay window, reconnect e snapshots.
2. Revisar JWT/JWKS/TTL, secrets, Origin, grants e RLS; retirar qualquer `service_role`/secret do browser.
3. Migrar resultado, saldo, score, cooldown, autoria e timestamps para decisão server-side e gravação idempotente.
4. Adicionar testes negativos de concorrência, replay, payload, autorização, reconnect, restart e eviction.

### Fase 2 — Realtime, chat e moderação

1. Fechar tópicos privados, membership, policies de `realtime.messages`, endpoint server-side de envio e estados de moderação.
2. Implementar block/report/appeal, auditoria mínima, retenção e limites; adicionar Turnstile apenas nos pontos de risco definidos.
3. Escolher Broadcast versus Postgres Changes por fan-out e durabilidade, com benchmark de duplicata, reordenação, reconnect e latência.

### Fase 3 — mobile, acessibilidade e 3D

1. Corrigir o gate Lighthouse mobile e validar LCP/INP/CLS com laboratório e RUM.
2. Fechar WCAG 2.2 AA para fluxos completos, teclado, foco, targets, contraste e status messages.
3. Medir 3D real, aplicar cache/reuso, instancing/merge/LOD, loop sob demanda quando cabível e qualidade adaptativa.
4. Anexar evidência reproducível; sem ela, manter a frente como pending mesmo que a execução local pareça correta.

### Fase 4 — SEO/i18n público

1. Inventariar locales reais e rotas públicas; gerar HTML localizado, canonical, hreflang recíproco, sitemap e 404/noindex.
2. Auditar chave de cache e impedir compartilhamento de HTML/API autenticado ou personalizado.
3. Validar HTML inicial, URLs absolutas HTTPS, `lang`/`dir`, conteúdo principal traduzido e comportamento sem JavaScript.

### Fase 5 — pesquisa SEO e experimentos de linguagem

1. Só ativar DataForSEO com credencial server-side, orçamento, cache, rate limit e necessidade editorial aprovada.
2. Implementar Ubersuggest apenas como CSV manual, sem scraping/API não suportada.
3. Só depois do produto estável, executar benchmark isolado TypeScript versus Go/WASM e, se houver decisão explícita, Rust/WASM; .NET/Blazor permanece protótipo separado até superar o gate de payload/startup/memória.

## Limites e decisões que não devem ser inventados

- Não transformar o limite de 32 MiB do runtime WebSocket em limite do jogo; o limite de aplicação deve ser menor e medido. [3]
- Não transformar 1.000 draw calls, 2.000 chamadas/minuto, 30 simultâneas, 700 keywords ou aproximadamente 3.000 assinantes em SLO do JogoManager; são limites/heurísticas documentados para contextos específicos e exigem benchmark próprio. [17] [41] [42] [68]
- Não tratar exemplos OWASP de tamanho/frequência como valores universais do jogo; usá-los apenas como ponto de partida para medição e revisão. [2]
- Não expor credenciais DataForSEO, Ubersuggest, Supabase secret/service_role, signing secret ou Turnstile secret em `VITE_*`, localStorage, query string, bundle ou logs. [6] [14] [40] [43] [49] [50]
- Não afirmar que RLS, Realtime private, Broadcast, WASM, TypeScript, assinatura de bundle ou esconder campos no cliente tornam o browser confiável. [7] [8] [27] [31]
- Não afirmar que Lighthouse, axe ou um único benchmark provam WCAG AA, Core Web Vitals de campo ou segurança do jogo. [52] [59] [60]

## Frentes sem evidência ou com falha explícita

- **Falha de validação do PR:** Lighthouse mobile e gate crítico estão `fail` no snapshot; precisam de correção e evidência antes de promoção.
- **Pendência de evidência:** `evidence` estava `pending`; não foi preenchida por esta pesquisa.
- **Rust/WASM:** sem fonte, benchmark ou implementação Rust nos resultados fornecidos; frente marcada como sem evidência, sem decisão de adoção.
- **Métricas atuais do repositório:** não foram fornecidos draw calls, triângulos, bytes reais, p95 de queries, fan-out, RTT, tick rate, tamanho de payload, usuários ou custo efetivo; nenhuma dessas medidas foi inventada.
- **Integrações e configuração:** plano Cloudflare/Supabase, região, grants/policies atuais, pipeline de deploy, locais/idiomas, orçamento DataForSEO e plano Ubersuggest não foram confirmados.
- **Falhas de pesquisa recebidas:** nenhuma (`Falhas: []`). Isso não elimina as falhas e pendências observadas no PR.

## References

[1]: https://datatracker.ietf.org/doc/html/rfc6455 "The WebSocket Protocol — RFC 6455"
[2]: https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html "WebSocket Security Cheat Sheet"
[3]: https://developers.cloudflare.com/workers/runtime-apis/websockets/ "WebSockets"
[4]: https://developers.cloudflare.com/durable-objects/best-practices/websockets/ "Use WebSockets"
[5]: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/ "Rules of Durable Objects"
[6]: https://supabase.com/docs/guides/auth/jwts "JSON Web Token (JWT)"
[7]: https://supabase.com/docs/guides/realtime/authorization "Realtime Authorization"
[8]: https://supabase.com/docs/guides/database/postgres/row-level-security "Row Level Security"
[9]: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/ "Rate Limiting | Cloudflare Workers Docs"
[10]: https://developers.cloudflare.com/durable-objects/reference/data-location/ "Data location"
[11]: https://supabase.com/docs/guides/realtime/broadcast "Broadcast | Supabase Docs"
[12]: https://supabase.com/docs/guides/functions/auth "Securing Edge Functions | Supabase Docs"
[13]: https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac "Custom Claims & Role-based Access Control (RBAC) | Supabase Docs"
[14]: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ "Validate the token | Cloudflare Turnstile Docs"
[15]: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm "Lei nº 13.709/2018 — texto compilado"
[16]: https://r3f.docs.pmnd.rs/advanced/pitfalls "Performance pitfalls"
[17]: https://r3f.docs.pmnd.rs/advanced/scaling-performance "Scaling performance"
[18]: https://threejs.org/manual/pages/optimize-lots-of-objects.html "Optimize Lots of Objects"
[19]: https://threejs.org/manual/pages/rendering-on-demand.html "Rendering on Demand"
[20]: https://threejs.org/manual/pages/load-gltf.html "Loading a .GLTF File"
[21]: https://developers.cloudflare.com/workers/reference/how-workers-works/ "How Workers works"
[22]: https://developers.cloudflare.com/workers/platform/limits/ "Limits"
[23]: https://vite.dev/guide/assets.html "Static Asset Handling"
[24]: https://go.dev/wiki/WebAssembly "Go Wiki: WebAssembly"
[25]: https://learn.microsoft.com/en-us/aspnet/core/blazor/hosting-models?view=aspnetcore-10.0 "ASP.NET Core Blazor hosting models"
[26]: https://learn.microsoft.com/en-us/aspnet/core/blazor/webassembly-build-tools-and-aot?view=aspnetcore-10.0 "ASP.NET Core Blazor WebAssembly build tools and ahead-of-time (AOT) compilation"
[27]: https://vite.dev/guide/features "Features — WebAssembly e Static Assets"
[28]: https://developers.cloudflare.com/workers/runtime-apis/webassembly/ "WebAssembly (Wasm) — Workers"
[29]: https://developers.cloudflare.com/workers/runtime-apis/webassembly/javascript/ "Wasm in JavaScript"
[30]: https://developers.cloudflare.com/workers/vite-plugin/reference/non-javascript-modules/ "Non-JavaScript modules"
[31]: https://www.typescriptlang.org/docs/handbook/2/basic-types.html "TypeScript Handbook: Basic Types"
[32]: https://tanstack.com/query/latest/docs/framework/react/guides/queries "Queries"
[33]: https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation "Query Invalidation"
[34]: https://developers.google.com/search/docs/specialty/international/localized-versions "Tell Google about localized versions of your page"
[35]: https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites "Managing multi-regional and multilingual sites"
[36]: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics "Understand the JavaScript SEO basics"
[37]: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls "How to specify a canonical URL with rel=canonical and other methods"
[38]: https://developers.cloudflare.com/workers/cache/cache-keys/ "Cache keys"
[39]: https://supabase.com/docs/guides/api/securing-your-api "Securing your API"
[40]: https://vite.dev/guide/env-and-mode "Env Variables and Modes"
[41]: https://docs.dataforseo.com/v3/dataforseo_labs-google-keyword_suggestions-live/ "Keyword Suggestions — DataForSEO Labs API v3"
[42]: https://docs.dataforseo.com/v3/dataforseo_labs-google-keyword_overview-live/ "Keyword Overview — DataForSEO Labs API v3"
[43]: https://docs.dataforseo.com/v3/auth/ "Authentication — DataForSEO API v3"
[44]: https://docs.dataforseo.com/v3/dataforseo_labs-google-bulk_keyword_difficulty-live/ "Bulk Keyword Difficulty — DataForSEO Labs API v3"
[45]: https://help.ubersuggest.com/hc/en-us/articles/4405444620059-Ubersuggest-API-and-Webhooks-What-Users-Need-to-Know "Ubersuggest API and Webhooks: What Users Need to Know"
[46]: https://help.ubersuggest.com/hc/en-us/articles/4405444702875-Exporting-Reports-with-Ubersuggest "Exporting Reports with Ubersuggest"
[47]: https://help.ubersuggest.com/hc/en-us/articles/22109561915419-Keyword-Ideas-Understanding-and-Using-the-Keyword-Tabs "Keyword Ideas: Understanding and Using the Keyword Tabs"
[48]: https://help.ubersuggest.com/hc/en-us/articles/9704437892635-Free-Account-Key-Features-and-Limits "Free Account: Key Features and Limits"
[49]: https://developers.cloudflare.com/workers/configuration/secrets/ "Secrets — Cloudflare Workers"
[50]: https://supabase.com/docs/guides/functions/secrets "Environment variables / Edge Function secrets"
[51]: https://www.w3.org/TR/WCAG22/ "Web Content Accessibility Guidelines (WCAG) 2.2"
[52]: https://www.w3.org/WAI/WCAG22/Understanding/conformance "Understanding Conformance"
[53]: https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html "Understanding Keyboard (SC 2.1.1)"
[54]: https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html "Understanding Focus Visible (SC 2.4.7)"
[55]: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html "Understanding Focus Not Obscured (Minimum) (SC 2.4.11)"
[56]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html "Understanding Target Size (Minimum) (SC 2.5.8)"
[57]: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html "Understanding Contrast (Minimum) (SC 1.4.3)"
[58]: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html "Understanding Status Messages (SC 4.1.3)"
[59]: https://web.dev/articles/vitals "Web Vitals"
[60]: https://web.dev/articles/vitals-field-measurement-best-practices "Best practices for measuring Web Vitals in the field"
[61]: https://web.dev/articles/vitals-spa-faq "How SPA architectures affect Core Web Vitals"
[62]: https://web.dev/articles/optimize-inp "Optimize INP"
[63]: https://web.dev/articles/optimize-lcp "Optimize LCP"
[64]: https://web.dev/articles/optimize-cls "Optimize CLS"
[65]: https://supabase.com/docs/guides/api/api-keys "API keys"
[66]: https://developers.cloudflare.com/cache/concepts/default-cache-behavior/ "Default cache behavior"
[67]: https://developers.cloudflare.com/cache/concepts/cache-control/ "Origin Cache Control"
[68]: https://supabase.com/docs/guides/realtime/postgres-changes "Postgres Changes"
[69]: https://supabase.com/docs/guides/realtime/benchmarks "Benchmarks"
[70]: https://supabase.com/docs/guides/realtime/limits "Realtime Limits"
[71]: https://supabase.com/docs/guides/database/postgres/indexes "Managing Indexes in Postgres"
[72]: https://supabase.com/docs/guides/database/query-optimization "Query Optimization"
[73]: https://www.postgresql.org/docs/current/ddl-rowsecurity.html "5.9. Row Security Policies"
[74]: https://www.postgresql.org/docs/current/routine-vacuuming.html "24.1. Routine Vacuuming"
[75]: https://supabase.com/docs/guides/database/connection-management "Connection management"
