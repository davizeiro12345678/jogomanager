Original prompt: Faça no GitHub uma mega atualização gráfica e de performance do Pro Football Manager 3D, preservando a arquitetura atual e entregando jogadores, estádio, gramado, torcida, redes, câmeras, iluminação, materiais, animações, transmissão, cinematics, LOD agressivo, menos draw calls, menos stutter e qualidade adaptativa medida.

## Estado atual

- Foi criado um clone limpo do repositório Lovable em `github-update`; a história publicada ainda não foi reescrita.
- A partida recebeu LOD de jogadores próximos, torcida em três níveis, grama por chunks, batching para elementos estáticos, quality governor por p95, medição de frame/draw/triângulos e um benchmark reproduzível em `graphics-benchmark.html`.
- A direção de transmissão voltou a usar planos aberto, drone, linha baixa, duelo, torre, netcam, órbita e comemoração com retenção temporal.
- O placar 3D passou a mostrar ao vivo/replay, relógio, posse e chutes; as famílias de celebração voltaram a ser registradas no catálogo de animações.
- `npm exec -- tsc -b --pretty false`, `npm test -- --run src/game/animation-catalog.test.ts` e `PFM_LOCAL_VERIFY=1 npm run build` passaram em 22/09/2026. A variável de build só evita um erro conhecido do gerador MCP do Lovable com caminhos do Windows e não entra no comportamento de produção.

## Medição e próximos passos

- Baseline Alto reproduzível já salvo em `docs/graphics/baseline.json`: 5.104 draws médios, 21,95 M triângulos médios, p95 235,1 ms e 6,43 FPS no viewport 1280x720 DPR 1.
- Uma amostra intermediária reduziu a cena a aproximadamente 715 draws e 787 mil triângulos, mas ainda precisa ser repetida após a correção do batching e inspecionada visualmente.
- Pendente nesta sequência: integrar hook determinístico no benchmark, capturar screenshot e console com Playwright, repetir a medição completa, registrar resultado em `docs/graphics`, executar a suíte total, revisar o diff e fazer commit/push normal para `main`.

## Iteração visual de 22/09/2026

- A captura em navegador mostrou dois defeitos visíveis: lâminas de grama em câmera alta pareciam espinhos escuros e a textura de doze fileiras de assentos era repetida dentro de um único degrau, criando moiré escuro.
- A correção limita lâminas de grama à câmera baixa/próxima, reduz a densidade e ajusta a escala; o gramado aberto fica no PBR com faixas. As fileiras passaram a amostrar uma fração correta da textura de assentos.
- A câmera broadcast agora permanece aberta em meio-campo e troca para duelo apenas na zona de perigo. Jogadores próximos aumentaram para oito rigs detalhados em Alto; os distantes usam corpo de cápsula/shorts, em vez de torso esférico.
- Iluminação diurna foi recalibrada para reduzir lavagem de cor; o HUD ganhou uma faixa de transmissão ao vivo/tempo de jogo.

## Entrega ampliada: transmissão, página inicial e loja pública

- O catálogo único de câmeras agora chega ao HUD da partida: além de TV, Tática, Gol, Torcida, Trilho e Replay, há Diretor, Cinema, Skycam, Lateral e Jogador. O diretor alterna grua, skycam, lateral e câmera do jogador pelo interesse do lance; os modos manuais fixam a lente solicitada.
- A página inicial ganhou acesso direto à loja, uma chamada acessível antes do login e uma seção que explica a direção de transmissão, os enquadramentos Cinema/Jogador e a personalização de estádio.
- A rota `/loja` não esconde mais o catálogo quando a pessoa está desconectada. Ela mostra pacotes, preço e conteúdo; o botão leva ao login antes do checkout, para associar entrega e histórico à conta correta.
- `docs/graphics/batch-c.json` registra uma execução completa de 119 s na mesma área de 1280×720 DPR 1: 715,6 draws médios e 787.828 triângulos médios, contra 5.104,1 draws e 21,95 M do baseline. O p95 caiu de 235,1 ms para 63 ms nesse navegador, mas ainda não cumpre a meta de 28 ms nem representa certificação em Android físico.
- `npm test -- --run src/game/animation-catalog.test.ts src/game/visual-context.test.ts src/game/narration-lines.test.ts src/features/ads/ad-manager.test.ts src/game/contracts/career-transfer.test.ts` passou com 66 testes. O build de produção local com `PFM_LOCAL_VERIFY=1` passou antes da camada final de UI; ele será repetido depois desta rodada antes do push.

## Validação final

- A checagem estrita `npm exec -- tsc -b --pretty false` passou depois de corrigir duas anotações de tipo nos testes de catálogo/caminho da loja.
- O build de produção `PFM_LOCAL_VERIFY=1 npm run build` passou. O bundle conserva avisos de dependências sobre `createServerFn().inputValidator()` e chunks já existentes acima de 500 kB; não são falhas deste patch.
- A inspeção WebGL do benchmark encontrou somente o aviso de depreciação `THREE.Clock`; um contexto foi perdido enquanto várias abas de benchmark recebiam HMR, por isso as métricas completas arquivadas em `batch-c.json`, e não essa amostra contaminada, são a referência usada no relatório.
- A vitrine de loja agora usa a consulta pública única de `store_products` para visitantes e contas autenticadas, com CTAs de login por pacote e estado não clicável enquanto a sessão carrega. Nomes, descrições, moedas e preços nunca têm fallback estático; se a consulta falhar, a vitrine mostra erro/retry sem anunciar oferta. As cores/ícones e lookup keys ficaram isolados como metadados locais; `createCheckoutSession` continua atrás de `requireSupabaseAuth` e resolve o Price real na Stripe. O retorno da loja da partida passa pela página de loja para não prometer salvar uma partida ao vivo que não pode sobreviver ao login.

## Câmeras, direção e benchmark — 22/09/2026

- `src/game/camera-modes.ts` passou a concentrar todos os IDs e textos das câmeras. Além dos modos existentes, Diretor, Cinema, Skycam e Lateral ficam descobríveis de maneira consistente em carreira, partida rápida, multiplayer, replays e benchmark.
- O rig 3D recebeu enquadramentos próprios de grua, skycam, lateral junto à área técnica, jogador e arquibancada. O Diretor escolhe esses planos por contexto do lance e usa a retenção/transição já existente; Cinema e Diretor habilitam o tratamento de lente apropriado no pós-processamento.
- O batching estático passou a aceitar uma assinatura explícita: grades, camarotes, portões, cobertura, refletores, arquibancadas e teto são reconstruídos apenas quando seus anéis, cores, horário ou qualidade mudam. Isso evita geometria/material antigo sem remesclar a cena nos re-renders normais do HUD.
- `scripts/graphics-benchmark.tsx` usa o mesmo `CAMERA_OPTIONS`, exibe a descrição do modo e aceita `?camera=<id>` para reproduzir uma tomada específica. Validação concluída: `npm test -- --run src/game/camera-modes.test.ts` (2/2), `tsc --noEmit`, `PFM_LOCAL_VERIFY=1 npm run build` e `npm exec -- vite build --config scripts/graphics-vite.config.ts` passaram. A captura Playwright precisa de Chromium local; ela não certifica visualmente esta rodada.

## Correção P1 da vitrine comercial — 22/09/2026

- `/loja` (`StorePanel`) e `/produtos` compartilham `useStoreCatalog`, cuja única fonte comercial é `store_products` com RLS público para itens ativos. A página pública deixou de gerar JSON-LD `Offer` estático e não exibe benefícios/recorrência que não estão no catálogo atual.
- Um produto retornado pela base sem lookup key conhecida da Stripe aparece, mas mantém o CTA indisponível. Visitantes recebem `Entrar para comprar` somente para itens mapeados; sessão indefinida recebe um CTA desabilitado. O servidor ainda exige `requireSupabaseAuth` antes de criar checkout.
- Validação da mudança: `npm exec -- tsc -b --pretty false`, `git diff --check` e `PFM_LOCAL_VERIFY=1 npm run build` passaram. O `npm run build` sem a flag continua encontrando a limitação conhecida do plugin MCP do Lovable ao comparar barras de caminho no Windows.

## Correção do lockfile Bun — 22/09/2026

- O `bun.lock` versionado estava defasado em relação ao `package.json` atual, fazendo o build remoto falhar em `bun install --frozen-lockfile`.
- O lockfile foi regenerado com Bun 1.2.15, sem alterar o manifesto: React e React DOM foram alinhados a `~19.2.0` e as entradas já declaradas de Playwright foram adicionadas.
- Validações concluídas: `bun install --frozen-lockfile` (715 installs em 888 pacotes, sem mudanças), build de produção local com `PFM_LOCAL_VERIFY=1`, e os testes direcionados de câmeras/orçamento de cena (6/6).
- A tentativa de suíte Vitest completa não iniciou nenhum arquivo e foi interrompida após ficar ociosa; isso não é tratado como aprovação da suíte completa. A inspeção de browser confirmou a página inicial renderizada, mas a certificação visual em um servidor de desenvolvimento limpo continua pendente por uma otimização local do Vite e por uma porta já ocupada.

## Fechamento de cinema, vitrine e checkout visitante — 22/09/2026

- `RuntimeSceneBudget` centraliza resolução, textura, grama, torcida por setor, bandeiras, props, heróis, partículas, sombras e pós-processamento. O Diretor preserva os 11 IDs de câmera e as preferências migradas em `manager3d.visual.v3`; o benchmark determinístico fixa Flamengo × Palmeiras, seed, cenário, 1280×720 e DPR 1.
- A massa de torcida distante passou a repetir UVs proporcionais à arquibancada, sem aumentar os quatro painéis/draws existentes. A página inicial mantém o hero estático no carregamento e só monta sua cena 3D depois da ação do visitante.
- `/produtos` e `StorePanel` agora oferecem `Comprar como visitante` para quem está desconectado. O fluxo usa intent idempotente, hash de e-mail, snapshot privado de preço/conteúdo, Stripe validada no servidor, magic link do Supabase e entrega atômica. O webhook trata o intent visitante antes de procurar `userId`.
- O checkout visitante permanece desligado por padrão. Sandbox exige `GUEST_CHECKOUT_SANDBOX_ENABLED=true`; live exige `GUEST_CHECKOUT_ENVIRONMENT=live` e `GUEST_CHECKOUT_LIVE_ENABLED=true`, além das chaves Stripe/Supabase e do webhook correspondente.
- Validação desta integração: `PFM_LOCAL_VERIFY=1 npm run build` passou; `npm test -- --exclude src/game/sim.stress.test.ts` passou com 10 arquivos e 85 testes; os 12 testes focados de câmera/orçamento/preferências/contrato comercial passaram; build do benchmark passou. A checagem TypeScript completa foi tentada no host atual, mas não terminou dentro da janela por saturação local de processos; agentes já haviam obtido sucesso em `tsc --noEmit` antes dos ajustes finais de UI/webhook.
- A certificação Android física, cobrança Stripe/Supabase real, aplicação das migrations e uma nova captura Playwright em servidor limpo continuam pendentes. As métricas `batch-c.json` ainda não atingem a meta p95 de Alto e não devem ser tratadas como certificação móvel.

## Fechamento seguro de cinema visual e checkout — 22/09/2026

- Estado inicial registrado na rodada anterior: Rapier era apenas uma ponte visual. Atualização em 23/09: corrigido e integrado `@dimforge/rapier3d-compat@0.19.2` como autoridade física canônica da bola no Worker ao vivo. `MatchSim` continua dona da posse, regras, resultados, eventos e replay; usa a trajetória Rapier em jogo ao vivo, preserva o integrador compatível em simulações rápidas/skip e faz fallback se o WASM falhar.
- A cabine de transmissão foi refinada para teclado, leitor de tela, redução de movimento e toque: abas de categorias têm navegação por setas/Home/End, foco volta ao gatilho ao fechar, controles têm alvo de 44 px e a categoria acompanha a lente realmente ativa. Os atalhos da partida não disparam enquanto a pessoa opera controles, links, diálogos ou campos.
- O checkout visitante passou a resolver o ambiente Stripe apenas no servidor, rejeitar discordância de chave pública/ambiente e proteger webhook, retorno tardio de pagamento e claim de intent. O catálogo e os CTAs públicos continuam visíveis sem login; a compra visitante fica intencionalmente desativada até que flags, migrations, Stripe e Supabase sejam configurados em produção.
- Validação concluída na rodada anterior: 35 testes focados, typecheck e build de produção. Nesta continuação, a suíte não estressada passou com 109 testes, typecheck estrito passou, build de produção passou e build dedicado do benchmark passou; 18 testes focados também cobriram simulação/Rapier/Worker.
- A captura Playwright inicial encontrou a página 404 porque foi servida pelo roteador TanStack. A prévia dedicada do benchmark responde 200; uma nova tentativa chegou ao renderizador SwiftShader e registrou apenas o aviso conhecido de `THREE.Clock`, mas não completou a captura dentro da janela do host. A QA visual final ainda não está certificada.
- A autoridade `rapier-ball-authority.*` agora está integrada ao Worker e à simulação canônica, com testes de regressão; incluir esta integração no commit.

## Próximos passos de certificação

- Servir o worker Cloudflare/Nitro em ambiente compatível e repetir Playwright com capturas de início, `/produtos`, diálogo visitante e cockpit durante uma partida.
- Aplicar a migration de checkout, configurar webhook Stripe/Supabase e testar sandbox com pagamento e claim reais antes de ativar as flags de visitante.
- Medir em Android físico antes de afirmar a meta de 40 FPS; manter a degradação adaptativa como proteção até essa certificação.

## Gate de entrega e correções de build — 23/09/2026

- O comando `npm test` agora exclui a simulação de estresse deliberadamente longa e executa a suíte determinística em processo isolado; `npm run test:stress` preserva a execução explícita do teste de carga fora do gate principal.
- O Vite local no Windows voltou a iniciar sem flag especial. O gerador MCP do Lovable é mantido em CI/Linux e Lovable, mas é pulado no Windows até que a comparação interna de caminhos do plugin aceite a normalização usada pelo Vite; as rotas geradas permanecem versionadas.
- Corrigido o contrato estrito de retorno do serializador canônico de sessão e implementada a peça ausente `AuthoritativeMatchSession`: tickets vinculados à sala/assento, sequências, limites, reconexão, recibos assinados idempotentes e snapshots públicos. A suíte completa sem estresse fechou em 21 arquivos e 130 testes, TypeScript estrito passou, assim como build da aplicação, build do benchmark e guard de assets.
- O navegador integrado deste host não alcança o `localhost` do processo de desenvolvimento; o servidor Vite respondeu na própria máquina e a navegação visual segue pendente de um host/browser que compartilhe a mesma rede. Isso não é uma certificação de UI ou GPU física.

## Continuação Rapier, benchmark e CI — 23/09/2026

- Rapier 0.19.2 foi restaurado como dependência direta e a bola da partida ao vivo passa pelo solver no Worker. Regras, posse, eventos, placar, carreira e replay continuam no `MatchSim`; caminhos de simulação rápida e skip preservam o comportamento determinístico, com sincronização da apresentação após o salto.
- O harness do benchmark agora deixa de aguardar `requestAnimationFrame` quando avança o fixture manual, evitando bloqueio em abas headless/ocultas. A validação da rota usa a entrada dedicada `graphics-benchmark.html`, pois a raiz TanStack não registra essa página estática.
- O Lighthouse CI aponta para a prévia Nitro/Cloudflare e sua regex de prontidão acompanha a mensagem real do servidor. Wrangler 4.136.3 ficou fixado como dependência de desenvolvimento para impedir instalação interativa de uma versão implícita.
- Validação final após sincronizar os tipos Supabase com as migrations: typecheck estrito passou; suíte sem stress: 18 arquivos e 109 testes; testes focados de física/benchmark/pagamentos: 6 arquivos e 20 testes; ESLint focado nos arquivos alterados: zero erros (um aviso de Fast Refresh); build de produção, build do benchmark e guard de assets passaram. O `bun install --frozen-lockfile` já passou depois de regenerar o lockfile. `npm audit --omit=dev --audit-level=high` passou e listou somente 11 vulnerabilidades baixas de dependências de produção.
- O ESLint global foi iniciado duas vezes, mas não terminou dentro da janela do host Windows, sem retornar erro; não está marcado como aprovado. O gate global continua configurado no workflow GitHub Actions para Ubuntu.
- A rota dedicada do benchmark respondeu HTTP 200 e o bundle compilou. O screenshot headless expirou aguardando fontes e a leitura do estado da cena não respondeu sob SwiftShader; não há certificação visual ou de GPU física nesta execução. O guard também confirmou que `public/game-assets` ainda não existe; não foram adicionados modelos/atlas 3D originais nesta rodada.
- Pendente fora do repositório: aplicar migrations/configurar Stripe e Supabase para testar compra real, medir em Android e fechar QA visual com GPU física. O checkout visitante permanece desligado por padrão.

## Mega atualização base+gráficos+cutscenes+UI — 27/09/2026 (branch arena/01a0e009-jogomanager)

- Base de jogadores: elenco do Villarreal estava órfão (chave `vil`, clube `vil_e`); `buildSquad` agora tolera clube fora do catálogo, descarta entradas malformadas, limita idade/overall/atributos, garante 2 goleiros e camisas/nomes únicos. `pickLineup` escala o goleiro primeiro, improvisa por posição parecida, guarda goleiro no banco e completa 11 com elenco curto. Partida rápida/match usam elenco enriquecido (fim de salário/valor zerados).
- Gráficos 3D: feixes volumétricos dos refletores + poeira + brilho de lâmpada (Atmosphere, custo fixo); torcida reativa a gol/chance/falta/pressão (CrowdReaction); marcas de chute/escorregão/rastro da bola em 1 draw call (PitchResponse); correção de cor por LUT 3D (grau por horário×clima×momento); suor/grama/chuva evoluindo nos materiais compartilhados (quantizado 3×3×2); camisa 512² só para heróis; vigia de orçamento por subsistema (DrawWatch). Integrado ao Stadium3D com gates por qualidade/WebGL2.
- Cutscenes: 60 → 76 roteiros (arco de história com 16 cenas: abertura, crise, ultimato, racha/união, demissão, reconstrução, ídolo...); direção cinematográfica por fala (emoção, plano, luz, pausa, clímax) plugada na timeline; sorteio contextual por 15 regras com marcos únicos e anti-repetição; palco 3D com 6 planos por cenário e câmera que reage à tensão; carreira exibe cenas no modo cinematográfico. Corrigido id inválido `celebration` no sorteio antigo.
- UI/UX: kit de telas compartilhado (NoCareer, ScreenHeader, SectionCard, StatStrip, EmptyState, ErrorPanel, SkeletonRows, PrimaryButton/Link); 18 telas migradas para o estado "sem carreira" único com navegação e CTAs; transferências com estado vazio acionável (limpar filtros) e esqueleto acessível; notícias com estado vazio acionável.
- Validação: typecheck estrito limpo, suíte 242/242 (era 198), 44 testes novos (integridade de elenco 9, módulos gráficos 15, história 20). Servidor dev responde 200 nas rotas migradas. Sem certificação de GPU física (pendente, como antes).

## Melhoria massiva rig+estádio+cutscenes+UI — 27/09/2026 (branch arena/01a0e009-jogomanager, local)

- Frente A (rig/modelo, ~735 linhas): 14 clipes novos (domínio de peito, primeiro toque, escorregão, levantar do carrinho, corrida de pênalti, mergulhos baixo/alto, cabeceio com salto, rabona, trivela, ombrada, reclamação, mancar, aperto de mão, aquecimento) — catálogo 237 → 251; osso `eyes` move íris/pupila com sacadas conjugadas atrás da bola (0 draws novos); expressões faciais por clipe (mandíbula/piscada/pálpebras/atenção do olhar); variação corporal (postura individual, envergadura por posição). Defesas alternam saída clássica/mergulho; mancar com fadiga extrema; escorregão raro no sprint.
- Frente B (estádio, ~540 linhas): ola mexicana no shader da torcida (viaja pelo anel, explode no gol); lateral viva (6 fotógrafos com flashes que enlouquecem no gol, 6 gandulas, 14 seguranças + 4º árbitro com placa de substituição); ambiente (7 gaivotas de dia, papel ao vento, mariposas nos refletores à noite); telão pisca "★ GOOOL! ★" no gol; bandeiras de escanteio com tecido ondulado no vértice.
- Frente C (cutscenes, ~505 linhas): direção cinematográfica agora manda no palco 3D (tamanho de plano por locutor, push-in dentro da fala, luz por fala, tremor+fov no clímax); figurante-herói de cada cenário gesticula ao falar; 7º cenário (chegada do ônibus à noite, com faróis, giroflex e torcida na grade); FX por set (flashes na coletiva, poeira no túnel, chuva de papel na festa); arco de história 16 → 22 cenas com 6 regras novas (sequência imparável, 100 jogos, enfermaria, fúria da torcida, diretoria satisfeita, cadeiras vazias); contador de falas no player.
- Frente D (UI/UX, ~410 linhas): radar 2D da partida em canvas (22 atletas + bola com brilho, anel em quem tem a posse, tecla M); elenco com busca/filtro por setor/ordenação; guia global de atalhos (tecla `?` + botão no topo); checklist de primeiros passos no dashboard para carreiras novas (dispensa persistida).
- Validação: `tsc -b` limpo; 48/48 nos testes focados (rig 17, história 20, timeline 11); orçamento de 6 heróis nos draws mantido. Commits locais (sem push — sessão remota encerrada): 7e07a2b, 9997e34, 38655f9, 89aab84.

## Visual massivo: banco+arbitragem+corpo+cerimônia+vestiário — 28/09/2026 (branch arena/01a0e009-jogomanager, local)

- Rig/personagens: banco de reservas vivo (BenchLife: casamata mesclada, 7 reservas/lado que pulam no gol, treinador que anda/comemora/desespera/aponta, 3 aquecendo atrás do gol); arbitragem completa (cartão vermelho com gesto de rua, assistente com bandeira erguida no impedimento, árbitro aponta o centro no gol, spray de barreira que some em ~9s); detalhe corporal (meião low/mid/high, fita de pulso e tatuagem de um lado só, brinco; teto articulado 54→56, HERO_MESH_COST e orçamentos de cena intactos).
- Estádio/cerimônia: PrematchCeremony 3D autocontida em 5 beats (~24s, pulável, preferência própria): entorno noturno (StadiumExterior: tigela + anel de LED do clube, ônibus chegando, torcida às catracas), saída do túnel, hino perfilado, mosaico com bandeirão do clube (ClubIdentity: textura em canvas + tecido ondulado) e sorteio com moeda ao ar; montada no match após as cutscenes 2D, com o sim pausado.
- Cutscenes jogáveis: 5 cenas com escolha e consequência (ChoiceEffect + applyChoiceEffect com trava 0..100 e manchete), elenco fixo determinístico por clube+temporada (cast.ts, 12 papéis com nome e rosto), 4 cenários 2D novos (bus/office/medical/gala) + mapeamento no palco 3D.
- Mercado+vestiário: empresário na negociação (agent.ts: 5 personas, humor, paciência, contraproposta, walk-away; comissão somada ao custo); vestiário no elenco (unhappy.ts: 5 motivos, 4 ações de conversa determinísticas por rodada, promessas cobradas com quebra); coletiva jogável (/coletiva: deck contextual de 5 perguntas, 3 tons, manchete pelo tom dominante, 1x por rodada; nav em 39 idiomas, legendas da cerimônia em pt+en com fallback).
- Validação: `tsc --noEmit` limpo; suíte 282/282 (43 arquivos), 30 testes novos (cast 5, agent 7, unhappy 9, choice-effects 4, rig-body mantidos); ESLint limpo nos arquivos tocados. Commit local (sem push — sessão remota encerrada).

## Jogador, cinema 3D e mundo persistente — 01/10/2026 (local)

- Anatomia, rosto, materiais e rig com 46 ossos; dedos e mãos articulados, locomoção com contato, ações em preparação/contato/recuperação e 27 movimentos inspecionáveis no estúdio. Integração preservada com os jogadores da partida e seus níveis de detalhe.
- Cinema com atores do mesmo rig, corpo sentado e transição de levantar, gestos e pequenas ações distintas, iluminação e câmera por falante, qualidade adaptativa e mesclagem de objetos estáticos. A camada 2D é removida quando o palco está pronto. Corrigida a montagem do diálogo dentro da área rolável: portal no body e controles da sequência dentro do modal.
- Mundo da carreira com personalidade evolutiva, 11 contextos de entrevista, relações individuais, consequências da torcida no público/bilheteria/pressão/estádio e memórias persistentes. Trava conjunta de entrevistas por rodada, conversas individuais limitadas e replay de galeria sem repetir recompensas. Semana sequencial no Worker existente.
- Navegador: escolha provocadora alterou Davi e persistiu após recarregar; coletiva antiga bloqueada; Varela rejeitou elogio e registrou a conversa; semana avançou com vitória 2–0; partida Flamengo x Fluminense rodou com pausa/retomada e câmeras. Sem novos erros de JavaScript nas consultas finais. O visual permanece estilizado.
- Gate final: 61 arquivos e 385 testes aprovados, 22 testes focados, TypeScript e os dois builds aprovados. ESLint focado sem erros; dois avisos de Fast Refresh já existentes. Sem certificação de 60 FPS, Android ou produção. Relatório e capturas em `verification/player-upgrade-2026-09-30/README.md` e `verification/career-world-2026-10-01/README.md`.

## Ajustes visuais de cutscenes e revisão de interface — 03/10/2026

- Pedido original: corrigir a primeira captura do criador de treinador, melhorar em conjunto as cutscenes usando a chegada ao clube da segunda captura como referência e procurar erros visuais/de interface nas telas mostradas.
- Chegada ao clube: carroceria e teto do ônibus com cantos arredondados; para-brisa com moldura e vidro escuro; rodas com cubos; faróis pequenos com luz localizada. Removidos os cones translúcidos exagerados e reduzido o giroflex azul que lavavam e atravessavam a composição. Janelas do centro de treino agora são vidro escuro com reflexo quente discreto.
- Todas as cenas: luz-chave compartilhada do retrato mais presente nos planos de ambientação, mantendo a intensidade própria dos planos de diálogo. Apliquei a mudança no componente comum, não em cópias de cada uma das 87 narrativas.
- Criador de treinador: foco de teclado antes escondido no título da etapa passa a contornar apenas o título. O contorno global dos títulos também se ajusta ao texto e não mais ao container largo.
- Elenco: o subtítulo “0 lesionados” sai de dentro do anel de condição e ocupa uma linha própria abaixo; valores não finitos ficam em zero e o SVG é marcado como decorativo para leitores de tela.
- Inspeção visual local: passos 1 e 2 do criador de treinador; tela de elenco sem carreira ativa; cenas de chegada, vestiário e coletiva. O projeto mostra 87 roteiros sobre ambientes compartilhados. Diálogo revelou a fala completa e avançou para a seguinte. A leitura do console do tab não encontrou errors. O log do servidor local mostrou avisos de depreciação `THREE.Clock` e `PCFSoftShadowMap`; o Canvas agora pede `PCFShadowMap` explicitamente. O botão de fallback do canvas apareceu na árvore de acessibilidade, mas permaneceu oculto enquanto o 3D estava pronto.
- No computador local com GPU Intel Iris Xe e perfil automático baixo, a prévia 3D do vestiário marcou primeiro frame em ~1,56 s e interatividade em ~3,52 s; a cena ficou visível em ~3,51 s. Essa é telemetria local de uma execução, sem comparação antes/depois e sem certificação de dispositivo ou produção.
- Validação: `npm run graphics:build`, `npm run build`, `npx tsc --noEmit --pretty false --incremental false` e `npx tsc -b --pretty false --force` passaram. A primeira chamada incremental de `tsc -b` retornou TS1184 isolado em `src/game/rig-skin.ts`; as duas execuções sem cache/forçada passaram, sem edição nesse arquivo. O build mantém avisos de API `inputValidator` depreciada, externalização `node:async_hooks` e chunk acima de 500 kB. O script Playwright do skill perdeu o contexto durante a montagem da cena; as confirmações visuais foram feitas no Chrome local.
- A captura completa do painel de condição da carreira ativa não foi reproduzida sem alterar um save local; o código do anel foi ajustado e a tela sem carreira foi inspecionada. Nenhum save ou dado de produção foi alterado.

## Pacote cinematográfico integrado — 03/10/2026

- Acrescentei IDs estáveis às 310 falas diretas e ramificadas das 87 cenas. O manifesto local PT-BR valida caminho, licença e faixa de visemas; permanece vazio até receber gravações licenciadas.
- Sincronizei animação de boca com `AudioContext.currentTime`; pausa, fim, pular, escolha e fechamento deixam a face em repouso. A instrumentação separa fundo visível, primeiro quadro 3D e cena interativa.
- Acelerei a resposta do QualityGovernor sob p95 muito acima do orçamento e tornei a recuperação gradual, mantendo o contrato RuntimeSceneBudget e a simulação sequencial. Normalizei a chave opcional no agrupamento do rig.
- Novo teste percorre direção/timeline das 87 cenas e cada resposta de escolha. Validação: 65 testes focados; full suite 673/674 (erro conhecido de acesso esbuild/Windows em `-quick-selection.test.ts`); TypeScript, ESLint focal e builds de produção/gráficos aprovados.
- Prévia visual verificada: vestiário e atores 3D; a resposta “Provocar o rival” avança de 3/3 para 3/5 sem tocar a carreira. Captura: `verification/integrated-cinematic-2026-10-03/playwright/shot-0.png`.
- Benchmark Iris Xe, alta/câmera Jogador/1280×720/DPR1: 17,0 FPS e p95 166,9 ms antes; 16,87 FPS e p95 155 ms depois. A amostra não prova ganho material de FPS, não exerceu a qualidade adaptativa e não atinge metas 30/60.
- Pendente: partida rápida local reverteu da tela “Carregando os gráficos” para a seleção antes da inspeção de controles; sem Android físico para certificação; sem gravações/licenças para completar dublagem. O Vite preview e Wrangler local também esbarraram no formato `.output` e em erro de acesso do esbuild no Windows. Ver `verification/integrated-cinematic-2026-10-03/README.md`.

## Auditoria estrutural ampla e correções — 03/10/2026

- Revisão paralela de carreira/saves, simulação/temporadas, multiplayer/segurança, rig/jogadores, e estádio/renderização. Foram executados cinco subagentes; o sistema recusou o sexto pedido com limite de threads, apesar da solicitação por nove.
- Saves de carreira agora reparam arrays e registros malformados sem interromper a carga; remapeamento de referências é defensivo. A chave de deduplicação de eventos inclui o clube, evitando suprimir eventos depois de troca de clube.
- Rodadas com folga avançam a simulação sem inventar placar 0–0, log de partida ou efeitos de resultado. A auditoria de temporada agora valida cobertura e duplicatas na tabela.
- Texturas canvas do estádio são descartadas no cleanup; reagrupamento de palco cinematográfico considera arte visual. Rebinding de materiais do jogador preserva geometria/esqueleto, e retries transitórios de KTX2 têm agendamento e cancelamento reais.
- Fluxo de sala multiplayer passou a validar participantes e clubes no servidor, gerar código/semente no servidor e publicar placar apenas após replay integral no servidor. Migrations 0018/0019 revogam escrita direta de usuários na sala e guardam semente numa tabela só do serviço; o cliente deixou de escrever pontuação/identidade diretamente. Ferramentas MCP de salvar/apagar carreira usam o contexto administrativo verificado e gravam progresso como não verificado.
- Validação local: suíte completa sem stress passou com 114 arquivos e 676 testes; TypeScript estrito passou; ESLint focal passou com zero erros e dois avisos de Fast Refresh em CrowdReaction. O build passou antes da migração das funções para a API validator atual, cuja validação final está em andamento. Avisos existentes incluem chunks grandes, import node:async_hooks externalizado e inputValidator depreciado nas funções legadas.
- Pendente: a validação de conquistas de carreira ainda não aceita progresso real porque o contrato atual só atesta um estado inicial pristine. Não removi a exigência de atestação; falta definir eventos de carreira replayáveis/atestáveis no servidor. Migrations 0018/0019 não foram aplicadas a um projeto Supabase; nenhuma mudança foi enviada ou publicada. Não houve certificação de navegador/GPU física, Android ou produção nesta auditoria.

## Dublagem PT-BR e limite de QA móvel — 03/10/2026

- Definido pelo usuário: um MP3 por fala, com interpretação em PT-BR neutro. Atualizei as instruções para as 310 falas e suas ramificações, incluindo nomes por lineId, compressão recomendada, visemas e comprovantes de licença.
- O usuário não tem aparelho Android. Não há certificação física A13; emulação móvel poderá verificar responsividade e interação, mas FPS e carregamento em aparelho ficam pendentes.
- Em Chromium 360 × 800, corrigi a sobreposição dos controles do estúdio de cinema. Confirmei busca, seletor e botão em linhas separadas, zero overflow horizontal e abertura da cena 3D com diálogo/controles. O manifesto agora rejeita outros formatos além de MP3. Não medi desempenho de aparelho.
- Em viewport compacta 320 × 720, a ramificação de escolha permaneceu dentro do diálogo sem rolagem horizontal.

### Validação final adicional — 03/10/2026

- API final: as funções multiplayer usam validator; typecheck e build de produção passaram depois da troca. Não há mais aviso inputValidator nessas funções, embora o build ainda reporte usos legados em outros módulos, a externalização de node:async_hooks e chunks acima de 500 kB.
- Smoke visual local em Chrome: tela de seleção e estádio 3D carregaram; a partida avançou. Pause manteve o minuto em 3 após 2,5 s, retomar avançou a simulação e a câmera mudou TV → Diretor → Jogador com enquadramentos visíveis. Voltei à seleção ao terminar; carreira não foi iniciada nem modificada.
- O cliente Playwright recomendado pelo skill não está disponível no checkout (sem pacote playwright); o smoke foi feito pela automação CUA do Chrome local. Console: a extensão do Chrome gerou erro de listener e atributo HTML que causou aviso de hydration mismatch; warnings de runtime incluem THREE.Clock depreciado e precisão no shader. Não observei exceção de gameplay, mas não fiz benchmark de GPU/FPS.

## Supabase, autenticação, pagamentos e auditoria de telas — 03/10/2026

- Inspecionei o login publicado e reproduzi falha no retorno OAuth do Google (`unexpected_failure` na troca do código). O painel Supabase também mostra valores de Client ID inválidos para Facebook, Discord, Azure e Figma; segredos permaneceram mascarados. A rota `/auth` confundia falha OAuth com link de e-mail expirado.
- Corrigi localmente a mensagem da rota de autenticação e incluí allowlist configurável para provedores sociais. `.env.example` documenta a opção; `.env.production` local usa `none` para ocultar botões sociais sem credenciais validadas no próximo build. A configuração publicada não foi alterada nem implantada.
- O diagnóstico read-only no Supabase encontrou 32 grupos de nome normalizado + clube com registros excedentes, mas todos têm datas de nascimento conflitantes. Nenhum foi mesclado ou apagado. A tabela `players` estava vazia e `official_players` tinha aproximadamente 42.127 linhas. A saúde do projeto estava degradada (CPU alta, taxa de erros da API em torno de 95% e sem backups visíveis); não executei escrita SQL nem migrations.
- Na carreira convidada do navegador, Elenco/Painel indicou dois Ganso na escalação/listas e um Douglas Costa marcado como goleiro; o painel sinalizou três camisas duplicadas ou inválidas. Esses dados pertencem ao save local e não foram alterados. Amostrei também autenticação, mercado/loja, táticas e partida; a cena 3D reportou indisponibilidade de WebGL no navegador embutido, então isso não é certificação de GPU ou cobertura exaustiva de todas as telas.
- Loja em sessão convidada desabilita compra por e-mail. Não fiz checkout nem cobrança. O código de integração Supabase/Stripe e os pré-requisitos Cloudflare foram inspecionados; não consegui validar chaves/webhook ou configuração remota. `wrangler whoami` está sem autenticação. `cloudflare:build` passou localmente; `cloudflare:check` falhou por acesso negado ao diretório `.cloudflare` gerado neste ambiente. Nada foi implantado.
- Validação final das alterações locais: `npm test` — 114 arquivos e 681 testes passaram; TypeScript, ESLint focal, Prettier e `npm run cloudflare:build` passaram. O build ainda mostra avisos legados de `inputValidator`, externalização de `node:async_hooks` e chunks grandes. Sem migrações, dados do banco, cobrança, deploy ou publicação.

- Ampliei a leitura visual para 23 rotas acessíveis da carreira convidada: autenticação, painel, criação, elenco, táticas, treino, liga, copas, estatísticas, notícias, resultados, mercado, olheiros, clube, finanças, diretoria, carreira, temporada automática (sem executar), conquistas, perfil, assistente, editor, loja, visual e partida. As telas carregaram sem erro explícito depois de aguardar a renderização; não interagi com compra, simulação, edição, chat, compras, multiplayer ou replay.
- Evidência adicional no elenco do save convidado: dois jogadores chamados Ganso aparecem entre os 11 titulares e em cada menu de substituição; Douglas Costa aparece tanto como goleiro titular quanto atacante reserva. É uma inconsistência reproduzível nesse save, sem correspondência segura com os duplicados de Supabase; nenhuma edição foi aplicada.
- Correção de escopo/contagem: foram abertas 24 rotas (incluindo `/dashboard`, `/new` e `/match`) e `/auth` à parte; os quatro painéis de chat, compras, multiplayer e replays não foram abertos.

## Pacote cinematográfico e atleta 3D — 03/10/2026

- **1. Cutscenes:** cenários principais agora reutilizam mapas procedurais PBR de cor, normal e rugosidade para piso de azulejo, madeira, parede, asfalto e gramado. As texturas são criadas e armazenadas em cache fora do loop de renderização.
- **2. Rig, anatomia, materiais e texturas:** acrescentei assimetria facial discreta e determinística em olhos, sobrancelhas, nariz, bochechas e boca. A posição animada das sobrancelhas no jogo e nas cutscenes respeita a mesma morfologia do rosto. A identidade procedural anterior continua estável.
- **3. Física visual:** roupa reage à velocidade angular do corpo e ao rolamento do tronco, com delta angular que atravessa corretamente o limite de ±π, resposta amortecida e deformação limitada. É movimento cosmético do tecido; a autoridade da partida, colisões, bola e resultados não mudaram.
- **Validação:** TypeScript, ESLint focal, Prettier focal e `npm run graphics:build` passaram. Os testes direcionados passaram (37 testes; o teste de orçamento de arquétipos precisou ser repetido isoladamente com timeout de 90 s porque excedeu o limite padrão de 30 s sob carga, e então passou). A validação final da roupa passou com 7 testes.
- **Limite visual:** a prévia carregou o fallback ilustrado em Chromium headless porque o Canvas WebGL do palco não inicializou, embora um teste de contexto WebGL separado estivesse disponível. Não considero isso inspeção visual do palco 3D, benchmark de GPU nem certificação de FPS em Android; o usuário informou que não tem aparelho Android.
