# Novas páginas, replays e grande salto de realismo nos jogadores

## 1. Página de produtos (`/produtos`)

Vitrine pública dos seis pacotes já existentes na loja (moedas pequenas, moedas médias, pacote de olheiros, pacote de treino, pacote de temas, passe de temporada).

- Cada pacote em um cartão grande com **render 3D ao vivo** girando devagar: baú de moedas, prancheta com relatório, apito/cone de treino, paleta de cores, troféu do passe.
- Preço formatado, o que vem dentro, e botão **"Comprar agora"** que abre o pagamento na hora (mesmo fluxo já usado na loja).
- Aviso de modo de teste no topo e selo de passe ativo quando for o caso.
- Página pública com título, descrição, imagem de compartilhamento e dados estruturados de produto.

Observação: os seis produtos **já estão ligados ao pagamento** dentro da loja atual. Esta página reaproveita essa ligação; nada será refeito do zero, apenas confirmado item a item (inclusive o passe mensal).

## 2. Estatísticas da carreira (`/carreira/estatisticas`)

- Números do treinador e do elenco: gols, assistências, minutos, partidas, média de nota e títulos.
- Gráficos: evolução de gols por rodada, barras dos artilheiros e garçons, rosca de minutos por posição, linha da forma do time.
- **Linha do tempo da carreira**: temporadas, clubes, títulos conquistados, contratações marcantes e momentos de crise, tudo em ordem.
- Tabela ordenável do elenco (gols, assistências, minutos, nota) com busca.
- Funciona offline, lendo o histórico já salvo no aparelho.

## 3. Replays das partidas (`/replays`)

Escolha confirmada: **replay 3D regravado + exportar vídeo quando quiser**.

- Toda partida jogada guarda um resumo leve dos lances (posições da bola e dos jogadores em intervalos curtos, gols, cartões, substituições) no armazenamento do aparelho.
- A galeria mostra cada partida como um cartão com escudos, placar, data e miniatura; ao abrir, a partida roda de novo em 3D com controles de tempo, câmera livre, câmera lenta e salto direto para cada gol.
- Botão **"Exportar vídeo"** grava o trecho em execução direto da tela e baixa o arquivo no aparelho (sem enviar nada para a nuvem). Aparelhos que não suportam gravação mostram só a opção de foto.
- Limite automático de 20 replays guardados, os mais antigos saem primeiro.

## 4. Menu do plano visual (`/visual`)

Página pública que apresenta o salto gráfico com seções: **gramado**, **clima**, **torcida**, **jogadores**, além de estádio e câmeras de TV. Cada bloco tem imagem, explicação curta e link para ver ao vivo na partida rápida com aquele ajuste. Título, descrição, imagem de compartilhamento, endereço canônico, dados estruturados e entrada no mapa do site.

## 5. Jogadores: geometria, texturas e 89 animações novas

- **Geometria**: torso e quadril modelados com curvas em vez de blocos, ombros e clavículas, joelho e cotovelo com dobra real, mãos com polegar, pescoço, pés com sola e calcanhar, cabeça mais anatômica com orelhas, sobrancelhas e olhar que segue a bola.
- **Tipos físicos** por atributos: alto e magro, forte e baixo, atlético, encorpado — muda altura, largura de ombro, grossura de perna.
- **Texturas**: pele com poros e variação de tom, camisa com trama de tecido e brilho de cetim, número e nome em relevo com costura, meiões com nervuras, chuteiras com travas e logotipo, luvas do goleiro, suor que cresce com o cansaço e lama que se acumula no uniforme durante o jogo.
- **89 animações novas** somadas ao conjunto atual, com transição suave entre elas:
  corridas (arrancada, freada, giro, passo lateral, recuo, cansado), condução e dribles (pedalada, elástico, chapéu, meia-lua, corte seco, caneta), passes e cruzamentos (trivela, três dedos, lançamento, passe de calcanhar, cruzamento rasteiro), finalizações (chapa, bicicleta, voleio, cavadinha, de primeira, cabeceio em salto, peixinho), defesa (carrinho, bote, bloqueio, corte de cabeça, disputa de ombro, interceptação), goleiro (defesa em três tempos, voo alto, encaixe, saída de soco, reposição, pênalti), bola parada (barreira pulando, cobrança de falta, escanteio, lateral, pênalti com passos marcados), reações (comemorações variadas, deslize de joelhos, abraço coletivo, dedo na boca, dança curta, decepção, reclamação com o árbitro, cartão recebido, cair e levantar, arrumar a chuteira, ofegante, dar instruções) e entrada em campo, aquecimento e substituição.
- **Movimento mais humano**: peso do corpo no passo, inclinação nas curvas, braços que equilibram, cabeça que vira antes do corpo, respiração visível e cansaço acumulando ao longo dos 90 minutos.

## 6. Estádio e cutscenes

- Estádio: rede em losango com nós e balanço com peso, trave que vibra, cobertura e refletores com feixe visível, placas de LED refletindo no gramado molhado, telão com o replay do lance, arquibancada setorizada com lotação variável e torcida reagindo ao placar.
- Cutscenes: câmeras com movimento contínuo e paralaxe entre camadas, luz conforme o horário, expressões do treinador e transição suave entre falas.

## Desempenho

Tudo entra por nível de qualidade (baixa, média, alta), com queda automática quando o aparelho não aguenta. No celular, os detalhes pesados ficam desligados e o jogo continua fluido.

## Detalhes técnicos

- Novas rotas: `src/routes/produtos.tsx`, `src/routes/carreira.estatisticas.tsx`, `src/routes/replays.tsx`, `src/routes/visual.tsx`; registro em `src/lib/seo.ts` (`seoMeta`/`canonical`), `PublicLinks.tsx` e `sitemap.xml.ts` para as páginas públicas (`/produtos`, `/visual`).
- Produtos: reaproveitar `PRICE_IDS` e `useStripeCheckout` de `src/routes/loja.tsx`, extraindo o catálogo para `src/game/store-catalog.ts`; renders 3D em `src/components/store/PackScene.tsx` com R3F (`Canvas` client-only, `dpr` limitado, `frameloop="demand"` fora do hover).
- Estatísticas: agregação sobre `career.matchLog` (`MatchPerformance`) em `src/game/stats.ts`; gráficos com Recharts já disponível.
- Replays: `src/game/replay.ts` (amostragem a 4 Hz do `SimState`, compactada) gravado em `src/lib/offline/store.ts` (IndexedDB, chave `manager3d.replays.v1`); player reusa `Stadium3D` com fonte de estado "replay"; exportação por `canvas.captureStream()` + `MediaRecorder` (webm), com detecção de suporte.
- Jogadores: reescrita da geometria em `src/components/game/players/PlayerRig.tsx` (LODs mantidos), novas texturas procedurais em `src/components/game/stadium/textures/` (pele, tecido, chuteira, sujeira), e ampliação de `src/game/animation.ts` com os 89 clipes novos + janela de mistura em `selectClip`.
- Estádio/pós/cutscenes: `Stadium3D.tsx`, `post/presets.ts`, `Cutscene.tsx`.
- Validação: `bunx tsgo --noEmit`, build limpo e conferência em `/partida-rapida?q=baixa|media|alta`, `/produtos` e `/replays` com captura de tela.

## Ordem de execução

1. Catálogo compartilhado + página de produtos com renders 3D
2. Gravação de replay e galeria com exportação de vídeo
3. Estatísticas da carreira com gráficos e linha do tempo
4. Página do plano visual com SEO
5. Geometria, texturas e 89 animações dos jogadores
6. Estádio, redes, torcida e cutscenes
7. Teste real nos três níveis de qualidade

## Fora do escopo

Nenhuma mudança nas regras da simulação, nos dados de clubes ou nos preços já definidos.
