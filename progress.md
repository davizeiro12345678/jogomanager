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
- A vitrine de loja agora usa o mesmo catálogo estático público de `/produtos` sempre que não há sessão confirmada, com CTAs de login por pacote e estado não clicável enquanto a sessão carrega. Usuários autenticados mantêm o catálogo vivo e checkout integrado; `createCheckoutSession` continua atrás de `requireSupabaseAuth`. O retorno da loja da partida passa pela página de loja para não prometer salvar uma partida ao vivo que não pode sobreviver ao login. `npm exec -- tsc -b --pretty false` passou após esse ajuste.
