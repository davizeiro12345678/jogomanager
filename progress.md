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
