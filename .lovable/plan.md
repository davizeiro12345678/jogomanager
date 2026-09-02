# Mega atualização: gráficos, ligas, UI/UX e novas mecânicas

Objetivo: elevar o Pro Football Manager 3D em quatro frentes — visual do jogo 3D, identidade dos clubes (logos/kits), volume de conteúdo (ligas e campeonatos) e profundidade de jogo (UI/UX + mecânicas de manager).

## 1. Estádio e jogadores em 3D
- Gramado com padrão de corte em faixas mais nítido, desgaste perto das áreas e reflexo suave sob os refletores.
- Jogadores com modelo melhor: corpo em segmentos (tronco, pernas, braços, cabeça), animação de corrida/chute, sombra própria, número nas costas e cor de pele/cabelo variando por jogador.
- Bola com rotação real, rastro em chutes fortes e efeito de rede ao balançar.
- Público animado (movimento sutil + ondas em gols), bandeirões atrás do gol nas cores do clube.
- Iluminação noturna com halos nos refletores, névoa leve, exposição cinematográfica.
- Câmeras: transmissão, tática (alta), atrás do gol e replay lento automático em gols.
- Placar/HUD estilo transmissão dentro da cena: escudo, sigla, placar, cronômetro.
- Modo de qualidade (Baixo/Médio/Alto) para manter fluidez em máquinas fracas.

## 2. Logos e kits
- Escudos gerados com mais variedade: formatos (escudo, círculo, losango), faixas, estrelas, iniciais e anel externo — todos derivados das cores e do nome do clube, sempre iguais para o mesmo clube.
- Kits com padrões reais: listras verticais, faixa horizontal, mangas contrastantes, xadrez, meia-camisa; kit titular, reserva e goleiro distintos, aplicados também no 3D.
- Bandeiras dos países revisadas e usadas em todo o app.

## 3. Muitas novas ligas e campeonatos
- Ampliar o banco de ligas (mais países e mais divisões: Europa, Américas, Ásia, África, Oceania), com elencos gerados a partir de bancos de nomes por país.
- Copas nacionais em mata-mata, com sorteio, chaveamento e final.
- Competição continental (fase de grupos + mata-mata) com classificação pela posição na liga.
- Supercopa de abertura de temporada.
- Calendário unificado que mistura liga, copa e continental por rodada.

## 4. UI/UX
- Layout de "central do clube" com cabeçalho de identidade (escudo, cores do clube aplicadas ao tema), navegação lateral com ícones e visão de próxima partida.
- Escalação com campo interativo (arrastar jogador para a posição), química/adequação por posição, indicadores de forma, condição e moral.
- Táticas com pré-visualização do campo e instruções por setor.
- Tabelas de liga com forma recente, artilharia e destaque do clube do usuário.
- Telas de partida com estatísticas ao vivo (posse, finalizações, mapa de chutes) e resumo pós-jogo.
- Estados vazios, carregamento e transições suaves; responsivo no celular.

## 5. Novas mecânicas
- Transferências: mercado com jogadores livres e de outros clubes, propostas, salários, negociação com aceitação baseada em reputação/valor.
- Finanças: orçamento, receita de bilheteria/patrocínio, folha salarial, saldo por temporada.
- Treinamento: foco semanal por setor, evolução e queda de atributos por idade.
- Lesões e suspensões: risco por intensidade de jogo, tempo de recuperação, cartões acumulados.
- Substituições durante a partida ao vivo (até 5) e ajuste de tática em tempo real.
- Progressão de temporada: fim de campeonato, promoção/rebaixamento, títulos, histórico e objetivos da diretoria.
- Notícias e estatísticas: manchetes por rodada, artilheiros, jogador do mês, histórico de carreira.

## Detalhes técnicos
- Persistência: manter a tabela `careers` (JSONB) já existente, com bump de `version` e migração automática de saves antigos para os novos campos (finanças, competições, lesões, histórico).
- `src/game/types.ts` ganha tipos para `Competition`, `CupTie`, `Finance`, `TrainingPlan`, `Injury`, `TransferOffer`, `NewsItem`.
- Novos módulos: `src/game/cups.ts`, `src/game/transfers.ts`, `src/game/finance.ts`, `src/game/training.ts`, `src/game/news.ts`; `season.ts` passa a montar um calendário agregado.
- `Stadium3D.tsx` é reescrito em módulos (`pitch`, `crowd`, `players`, `cameras`, `hud`) para manter o arquivo legível.
- `Crest.tsx` e `kits.ts` recebem geradores determinísticos por hash do id do clube.
- Design tokens em `src/styles.css` para o tema broadcast; nada de cores fixas nos componentes.
- Novas rotas em `_authenticated/`: `transfers`, `finances`, `training`, `cups`, `news`, `history`.

## Entrega em fases
1. Gráficos do estádio/jogadores + escudos e kits.
2. Ligas e campeonatos novos (copas, continental, calendário).
3. UI/UX de todas as telas.
4. Mecânicas (transferências, finanças, treino, lesões, substituições, progressão, notícias).

Cada fase é verificada com typecheck e captura do preview antes de seguir.
