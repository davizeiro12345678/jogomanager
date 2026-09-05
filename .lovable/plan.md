# Mega atualização: jogadores, estádio e interface

Três frentes numa entrega só: corpo e movimento dos jogadores muito melhores, estádio com mais vida e telas mais bonitas e claras.

## 1. Jogadores

- **Corpo**: proporções revistas (pescoço, ombros, quadril, panturrilha), silhueta mais humana e menos "boneco"; cabelo, barba e tom de pele com mais variação.
- **Uniforme**: camisa em resolução maior, com nome e número nas costas legíveis, gola e punhos na cor secundária, meias com faixa e chuteiras coloridas; goleiro com kit e luvas próprios.
- **Movimento**: passada com apoio no chão (o pé para de escorregar), inclinação do corpo na curva, balanço de braços proporcional à velocidade, frenagem e giro em direção à bola.
- **Novos movimentos**: passe curto, cruzamento, cabeceio, carrinho, condução com a bola, disputa de ombro, comemorações variadas e goleiro em mergulho/reposição.
- **Acabamento**: sombra de contato mais suave, leve brilho de suor no modo Alto, e troca de nível de detalhe por distância mais gradual (sem "pop").

## 2. Estádio

- **Gramado**: fibras que respondem ao vento e à passagem da bola, faixas de corte mais nítidas, desgaste na área e no círculo, brilho úmido sob refletor.
- **Torcida**: mais densa e em camadas, mosaico nas cores da casa, ola, pulos no gol, flashes de câmera e bandeirões maiores ondulando.
- **Estrutura**: cobertura com treliça, telão legível, placas de LED trocando anúncios, bandeirinhas de escanteio tremulando, banco de reservas com pessoas.
- **Clima e luz**: dia, entardecer e noite com céu e cor de luz próprios; halo dos refletores e leve névoa à noite.
- **Câmeras**: suavização em todas, tremor leve em lance de perigo e replay de gol em câmera lenta com foco na jogada.
- **Acabamento de imagem**: brilho, contraste e granulação ajustados por nível de qualidade, com preset mais cinematográfico no replay.

## 3. Interface

- **Tela da partida**: painel estilo transmissão — placar, relógio, barra de posse animada, cartões, substituições e linha do tempo de lances deslizante; controles de velocidade e câmera reorganizados e confortáveis no celular.
- **Central do clube e painéis**: cartões com entrada suave, números que sobem contando, barras de moral e forma animadas, transição entre abas.
- **Navegação**: barra lateral com escudo grande, ícones e destaque da próxima partida; cores do clube escolhido aplicadas em toda a interface.
- **Listas**: elenco, mercado e classificação com cabeçalho fixo, ordenação e leitura melhor em tela pequena.
- **Estados**: telas de carregamento e telas vazias amigáveis em vez de espaço em branco.
- Tudo respeita "reduzir movimento" do sistema e mantém o desempenho no celular.

## Detalhes técnicos

- `src/components/game/players/PlayerRig.tsx` (790 linhas) é dividido em `players/` (`Body`, `Head`, `Kit`, `Shadow`) e ganha travamento de pé por IK simples; novos clipes entram em `src/game/animation.ts` e a escolha em `selectClip`.
- `src/game/player-model.ts` recebe proporções e variação de aparência ampliadas; `src/game/kits.ts` sobe a resolução da textura e adiciona nome/número.
- `src/components/game/Stadium3D.tsx` (1858 linhas) é quebrado em `stadium/` (`GrassField`, `Stands`/`Crowd`, `Goal`, `Floodlights`, `AdBoards`, `Sky`, `Post`) para ficar sustentável; shaders via `onBeforeCompile` e pós-processamento por nível em `post/`.
- Interface: novos componentes de HUD e painéis animados em `src/components/game/`, tema por clube já existente em `src/game/theme.ts`; sem cores fixas nos componentes.
- Verificação por screenshot no navegador em cada fase, mais `tsgo --noEmit` limpo.

## Ordem de entrega

1. Jogadores (corpo, kit, passada, novos movimentos).
2. Estádio (grama, torcida, estrutura, luz, câmeras/replay).
3. Interface (HUD da partida, painéis, navegação, listas).
