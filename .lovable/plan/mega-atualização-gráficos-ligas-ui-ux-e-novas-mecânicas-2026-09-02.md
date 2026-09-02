# Mega atualização: gráficos, ligas, UI/UX e novas mecânicas

Transformar o Pro Football Manager 3D em um manager completo e com cara de transmissão de TV: partida 3D cinematográfica, identidade visual própria para cada clube, dezenas de competições e um ciclo de temporada com profundidade de verdade.

## Visão geral da experiência
- Ao abrir o jogo: "central do clube" com identidade visual do seu time (cores, escudo, manchete do dia, próxima partida, tabela).
- Matchday: estádio 3D com transmissão ao vivo — placar de TV, estatísticas, replay de gols, substituições e ajustes táticos em tempo real.
- Entre jogos: mercado de transferências, treinamento semanal, finanças, lesões e notícias do mundo da liga.
- Fim de temporada: títulos, promoção/rebaixamento, prêmios individuais, objetivos da diretoria e histórico de carreira.

## 1. Estádio e jogadores em 3D (matchday)
- **Gramado**: faixas de corte nítidas, desgaste próximo das áreas, reflexo molhado sob os refletores, marcações precisas (ponto de escanteio, marcas de tiro de meta).
- **Jogadores**: modelo articulado (tronco, braços, pernas, cabeça) com animação de corrida, passe, chute, carrinho e comemoração; sombra individual; número e nome nas costas; variação de pele, cabelo, altura e biotipo por jogador.
- **Bola**: rotação física, curva em chutes com efeito, rastro em finalizações fortes, rede que balança de verdade.
- **Ambiente**: público animado com movimento e "ola" em gols, bandeirões nas cores do clube, banners de torcida, publicidade dinâmica nos painéis de LED, névoa leve e halos de luz nos refletores, exposição cinematográfica (dia/noite/pôr do sol conforme horário da partida).
- **Câmeras**: transmissão, tática (alta), atrás do gol, lateral próxima; replay em câmera lenta automático em gols e grandes defesas; transições suaves entre ângulos.
- **HUD de transmissão**: placar com escudos e siglas, cronômetro, barra de posse, log de lances, estatísticas ao vivo (finalizações, posse, mapa de chutes), mini-map com posições.
- **Performance**: modos Baixo/Médio/Alto, instâncias para a multidão, LOD automático para manter 60fps em máquinas fracas.

## 2. Logos, kits e identidade
- **Escudos gerados**: formatos variados (escudo clássico, círculo, losango, emblema), composições com faixas, divisórias, estrelas de títulos, iniciais e ano de fundação — tudo determinístico por id do clube (sempre o mesmo escudo), em SVG nítido em qualquer tamanho.
- **Kits**: padrões reais (listras verticais/horizontais, faixas, meia-camisa, mangas contrastantes, xadrez, gradiente sutil), com kit titular, reserva, terceiro e kit de goleiro exclusivo; meias e calções combinando; aplicados nos jogadores 3D.
- **Bandeiras e temas**: bandeiras nacionais corrigidas e usadas em todo o app; cada tela do clube adota as cores do time via tokens semânticos.

## 3. Ligas e campeonatos (muito mais conteúdo)
- **Dezenas de ligas**: além das atuais, novas ligas e divisões na Europa, Américas, Ásia, África e Oceania, cada uma com clubes, cores e forças próprias; elencos gerados a partir de bancos de nomes por país/região.
- **Copas nacionais**: mata-mata com sorteio, ida e volta (com gol fora qualificado), chaveamento visual e final em estádio neutro.
- **Continental**: fase de grupos + mata-mata, classificação automática conforme posição na liga, calendário em noites de semana.
- **Supercopa**: abertura de temporada entre campeão da liga e da copa.
- **Calendário unificado**: todas as competições integradas por data, com congestionamento de jogos, rodízio e fadiga.
- **Classificação automática e rebaixamento** ligando divisões do mesmo país entre temporadas.

## 4. UI/UX
- **Central do clube**: cabeçalho com escudo/cores, manchetes, próxima partida com contagem regressiva, forma recente, alertas (lesão, proposta de transferência).
- **Escalação interativa**: campo com arrastar-e-soltar por posição, indicação de adequação (fora de posição penaliza), forma física, moral e condição; sugestão automática.
- **Táticas**: pré-visualização no campo, mentalidade/pressão/linhas, instruções por setor (defesa, meio, ataque) e estilos (contra-ataque, posse, cruzamentos).
- **Liga e copas**: tabelas com forma, artilharia, cartões, histórico do confronto; chaveamento de copa navegável.
- **Matchday**: painel com estatísticas ao vivo, eventos, substituições por drag (até 5), mudança tática sem pausar; tela pós-jogo com nota dos jogadores, melhor em campo e reação da imprensa.
- **Polimento**: skeletons de carregamento, estados vazios amigáveis, transições suaves, atalhos de teclado, totalmente responsivo no celular.

## 5. Novas mecânicas de manager
- **Transferências**: mercado com jogadores livres e de outros clubes, busca/filtros por posição e potencial, propostas com valor + salário, negociação com contraproposta, janelas de transferência e rumores na imprensa.
- **Finanças**: orçamento inicial por força do clube, receita de bilheteria, TV e patrocínio (cresce com resultados), folha salarial, saldo por temporada; diretoria cobra equilíbrio.
- **Treinamento**: foco semanal (ataque, defesa, físico, jovens), evolução de atributos por idade e minutos jogados; queda em veteranos.
- **Lesões e suspensões**: risco por fadiga/intensidade, tempo de recuperação estimado, acúmulo de amarelos e vermelhos diretos.
- **Partida ao vivo**: substituições, ajuste de mentalidade/pressão em tempo real, lesão durante o jogo, moral afetando desempenho.
- **Progressão de temporada**: encerramento com premiações (campeão, artilheiro, craque da temporada), promoção/rebaixamento, títulos na sala de troféus, objetivos da diretoria (meta de posição) afetando aprovação do técnico — risco de demissão e ofertas de outros clubes.
- **Notícias**: feed com manchetes por rodada, destaques de transferência, lesões e premiações.
- **Estatísticas e histórico**: líderes por temporada, recordes do clube, carreira do manager (clubes, títulos, aproveitamento).

## 6. Técnica (como será construído)
- **Persistência**: mantida a tabela `careers` (JSONB) com políticas de dono; `CareerState.version` sobe para 2 com migração automática de saves antigos (preenche finanças, competições, lesões e histórico com valores padrão).
- **Novos tipos** em `src/game/types.ts`: `Competition`, `CupTie`, `Group`, `Finance`, `TrainingPlan`, `Injury`, `TransferOffer`, `NewsItem`, `SeasonHistory`, `ManagerProfile`.
- **Novos módulos**: `src/game/cups.ts` (mata-mata e grupos), `src/game/calendar.ts` (agregador), `src/game/transfers.ts`, `src/game/finance.ts`, `src/game/training.ts`, `src/game/injuries.ts`, `src/game/news.ts`, `src/game/progression.ts`; `season.ts` vira fonte única do calendário.
- **3D modular**: `Stadium3D.tsx` dividido em `stadium/pitch.ts`, `stadium/crowd.ts`, `stadium/players.ts`, `stadium/cameras.ts`, `stadium/hud.tsx`, `stadium/lighting.ts` — cada parte testável e legível.
- **Geradores determinísticos**: `Crest.tsx` e `kits.ts` usam hash do id do clube; banco de nomes ampliado em `data/names.ts` por país.
- **Design tokens**: tema broadcast em `src/styles.css` (cores, sombras, gradientes semânticos); zero cor fixa nos componentes; tema dinâmico por clube via CSS custom properties.
- **Novas rotas** em `_authenticated/`: `transfers`, `finances`, `training`, `cups`, `news`, `history`; `club.tsx` vira a central.
- **MCP**: ferramentas ganham leitura ampliada do estado (tabelas, notícias) mantendo segurança por usuário.

## Entrega em fases (verificadas uma a uma)
1. **Gráficos**: estádio, jogadores, bola, câmeras, HUD; escudos e kits novos.
2. **Conteúdo**: novas ligas, bancos de nomes, copas, continental, supercopa, calendário.
3. **UI/UX**: central do clube, escalação interativa, telas de liga/copas, matchday, responsivo.
4. **Mecânicas**: transferências, finanças, treino, lesões, substituições ao vivo, progressão de temporada, notícias, histórico.

Cada fase termina com typecheck e captura de tela do preview antes de avançar.
