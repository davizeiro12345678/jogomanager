# Mega atualização: dados reais, gráficos, desempenho e partida rápida

Quatro frentes numa só entrega: trazer os dados reais das APIs, elevar o visual do estádio, deixar o jogo leve no celular e criar uma tela de partida avulsa contra o computador.

## 1. Importação real em 5 grandes lotes

Hoje a importação já existe, mas roda em pedaços pequenos. Vamos executá-la em 5 chamadas grandes, cada uma com orçamento de tempo próprio, até cobrir todo o catálogo (115 competições, ~1.368 clubes):

1. Competições e clubes do catálogo interno para o banco.
2. Escudos e cores oficiais (lote 1 de clubes).
3. Escudos e cores oficiais (lote 2 de clubes).
4. Uniformes e estádios.
5. Elencos reais (jogadores, posições, idades) dos clubes principais.

Cada lote grava um registro de execução, é repetível sem duplicar nada e continua de onde parou se estourar o tempo. Clubes sem dado oficial mantêm o escudo desenhado pelo jogo, então nada fica em branco.

## 2. A maior atualização gráfica

- **Grama**: shader próprio com fibras que se inclinam ao vento, faixas de corte com brilho direcional, desgaste na área e marcas de pisada perto da bola.
- **Torcida**: arquibancada mais densa e em camadas, com cores do time, movimento em ondas, bandeirões, aplausos em gol e flashes de câmera.
- **Estádio**: cobertura, estruturas, telão, placas de publicidade, névoa e refletores com brilho volumétrico; céu que muda com o horário.
- **Jogadores**: sombra de contato melhorada, camisa com leve ondulação, suor/brilho conforme a luz.
- **Pós-processamento**: bloom, aberração leve, granulação e viñeta ajustadas por nível de qualidade, com preset "cinema" para replays de gol.

## 3. Painéis animados (continuação)

Cartões com entrada suave, números que sobem contando, barras de moral/forma animadas, transição entre abas, HUD da partida com relógio, placar, cartões, substituições e linha do tempo de eventos deslizante. Tudo respeitando "reduzir movimento" do sistema.

## 4. Desempenho em celular e tablet

- A simulação da partida passa a rodar num **Web Worker**: o cálculo do jogo sai da tela, então nada trava em partidas longas nem quando a aba fica em segundo plano.
- Detecção automática de aparelho: celular entra em qualidade média, aparelhos fracos em baixa, com opção manual sempre visível.
- Limite de pixels da tela, sombras e partículas reduzidas no celular, texturas menores e menos torcedores.
- Pausa o desenho 3D quando a aba está escondida, mantendo o relógio da partida certo.

## 5. Tela de partida rápida

Nova tela "Partida rápida": escolhe o seu time e o adversário (ou sorteia), define duração e dificuldade, e joga contra o computador com:

- Placar ao vivo, relógio e eventos em tempo real.
- Narração por voz nos idiomas suportados, com botão de mudo.
- Controles de velocidade, pausa e pular para o fim.
- Súmula final com notas, chutes e melhor em campo.

Não afeta a carreira salva — é um jogo avulso.

## Detalhes técnicos

- Importação: `runSync` em `src/lib/football-sync.server.ts` chamada em 5 escopos (`seed`, `clubs` x2, `kits`, `squads`) via `/api/public/sync-football` com `limit`/`offset`/`budgetMs` maiores; idempotente por `upsert`.
- Worker: novo `src/game/sim.worker.ts` hospedando `MatchSim`; protocolo de mensagens (`init`, `step`, `speed`, `sub`, `snapshot`) e um `useMatchSim` que expõe a mesma API atual para `match.tsx` e para a nova rota, com fallback para execução na thread principal se o worker falhar.
- Gráficos: shaders via `onBeforeCompile`/`ShaderMaterial` em `Stadium3D.tsx` (grama, torcida instanciada com atributo de fase, telão), pós-processamento com `@react-three/postprocessing` por nível de qualidade.
- Qualidade automática: heurística com `navigator.hardwareConcurrency`, `deviceMemory` e ponteiro grosso; `dpr` limitado e `frameloop` pausado em `visibilitychange`.
- Nova rota `src/routes/partida-rapida.tsx` (`ssr: false`, `noindex`) reaproveitando `Stadium3D`, `narrator.ts` e `MatchReport`.
