# Mega atualização: interface, experiência, mecânicas e gráficos

Objetivo: deixar o jogo com cara de transmissão de TV, com telas mais bonitas e claras, e com camadas de gestão que dão o que fazer entre as partidas.

## 1. Interface e experiência

- **Central do clube** redesenhada: cabeçalho com escudo grande, cores do próprio clube aplicadas na tela inteira, próxima partida em destaque com contagem de rodada, forma recente em sequência de bolinhas e alertas (lesão, proposta recebida, jogador insatisfeito).
- **Tema por clube**: as cores do time escolhido passam a colorir botões, gráficos e destaques, mudando de verdade a cara do jogo conforme o clube.
- **Elenco**: filtros por posição, idade e nível, ordenação por qualquer coluna, comparação lado a lado de dois jogadores e indicação de melhor posição.
- **Táticas**: campo interativo com arrastar-e-soltar dos jogadores, aviso quando alguém está fora de posição, presets salvos (posse, contra-ataque, pressão alta).
- **Partida**: painel pós-jogo com notas dos jogadores, melhor em campo, mapa de finalizações e súmula.
- **Polimento geral**: animações de entrada, estados de carregamento, telas vazias amigáveis, tudo confortável no celular.

## 2. Mecânicas novas

- **Substituições ao vivo** (até 5) e ajuste de mentalidade/pressão sem pausar.
- **Coletiva de imprensa** antes e depois do jogo, com respostas que mexem na moral do elenco e na aprovação da torcida.
- **Treino semanal** com foco (ataque, defesa, físico, base), evolução de atributos e risco de lesão por intensidade.
- **Copa nacional** em mata-mata e **competição continental** com fase de grupos, integradas ao calendário da temporada.
- **Negociação de transferência** com contraproposta, empréstimos e parcelas; clubes da IA negociando entre si.
- **Contratos**: renovação, pedido de aumento, jogador entrando no último ano e saindo de graça.
- **Fim de temporada**: premiações, artilheiro, promoção/rebaixamento, aposentadorias e nova temporada continuando a carreira.

## 3. Gráficos

- **Gramado**: faixas de corte mais nítidas, desgaste nas áreas, brilho úmido sob os refletores e marcações completas.
- **Jogadores**: animações novas (passe, carrinho, cabeceio, comemorações variadas, goleiro em mergulho), reação ao gol e corrida com braços.
- **Bola**: rotação real, curva em chutes com efeito, rastro em finalizações fortes e rede que balança.
- **Estádio**: torcida com mosaico nas cores da casa, bandeirões, "ola" no gol, placar eletrônico 3D, painéis de LED, fumaça na comemoração.
- **Câmeras**: replay automático de gol em câmera lenta, além dos ângulos atuais.
- **Desempenho**: qualidade automática por aparelho e alvo de 60fps em notebook comum.

## 4. Notas técnicas

- O estado da carreira continua sendo um único registro salvo; sobe de `version: 3` para `4` com migração automática que preenche treino, copas, contratos e histórico nos saves antigos — sem mexer no banco.
- Novos módulos em `src/game`: `cups.ts`, `training.ts`, `press.ts`, `contracts.ts`, `progression.ts`; `season.ts` passa a ser a fonte única do calendário.
- `Stadium3D.tsx` (1410 linhas) é dividido em partes menores (gramado, torcida, luzes, câmeras) para ficar sustentável.
- Tema por clube via variáveis de cor no CSS; nenhuma cor fixa nos componentes.

## Ordem de entrega

1. Gráficos do estádio, jogadores e bola + replay de gol.
2. Interface: central do clube, tema por clube, elenco e táticas interativas.
3. Mecânicas de partida: substituições, ajustes ao vivo, pós-jogo e coletiva.
4. Temporada: copas, continental, treino, contratos, transferências negociadas.
5. Fim de temporada, premiações e progressão plurianual.

Cada etapa termina com verificação no navegador antes de seguir.
