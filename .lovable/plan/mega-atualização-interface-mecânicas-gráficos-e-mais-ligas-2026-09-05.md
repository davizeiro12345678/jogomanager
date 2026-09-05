# Mega atualização: interface, mecânicas, gráficos e mais ligas

Hoje o jogo tem 52 ligas (~700 clubes), interface em abas simples e importação de dados real dividida em várias chamadas. Esta atualização amplia o mundo do jogo, redesenha a interface e melhora a partida em 3D.

## 1. Mais ligas, clubes e campeonatos

- Novas ligas nacionais: Rússia, Israel, Hungria, Bulgária, Eslováquia, Eslovênia, Chipre, Irlanda, Finlândia, Islândia, Venezuela, Costa Rica, Índia, China, Malásia, Vietnã, Argélia, Tunísia, Gana, Quênia, Angola, mais segundas divisões (Portugal, Holanda, Brasil Série C, Argentina Nacional B, Turquia, Escócia).
- Cada nova liga entra com elenco de clubes reais (nome, sigla, cores, força), no mesmo formato do catálogo atual — cerca de 300 clubes a mais.
- Copas e torneios: copa nacional eliminatória em cada país, três competições continentais (Champions/Europa, Libertadores/Sul-Americana, Champions Asiática/Africana) e Supercopa, com chaveamento, calendário próprio, premiação em dinheiro e troféus no histórico do treinador.

## 2. Importação de dados reais em uma única execução

- Um único acionamento passa a rodar tudo: escudos, estádios, fundação, kits e elencos reais de todas as ligas, com retomada automática por lotes (o processo continua de onde parou quando o tempo acaba, sem precisar chamar de novo com outros parâmetros).
- Painel de importação dentro do jogo mostrando progresso, quantos clubes já têm escudo/kit/elenco real e o que falhou.
- Quando um clube ainda não tem dado real, ele continua usando o escudo e o kit gerados — nada quebra.

## 3. Interface e experiência

- Novo layout do painel: barra lateral com seções agrupadas (Clube, Elenco, Jogo, Mercado, Mundo), cabeçalho com escudo, posição na tabela, saldo, moral e próxima partida.
- Central do clube redesenhada em cartões: próximo adversário com prévia, forma recente, destaques do elenco, tarefas pendentes (contratos vencendo, lesionados, propostas).
- Tela de elenco com filtros, comparação lado a lado, barras de atributo e busca; mercado com negociação em etapas.
- Modo escuro/claro por clube, animações de transição, estados de carregamento e telas vazias, acessibilidade por teclado e layout mobile revisado.

## 4. Mecânicas novas

- Coletiva de imprensa pré e pós-jogo influenciando moral e pressão.
- Conversas individuais com jogadores (elogio, cobrança, promessa de minutos).
- Olheiros com relatórios por região e nível de certeza, categoria de base gerando promessas.
- Renovação e rescisão de contrato com cláusulas, empréstimos com salário dividido.
- Preparação de partida: instruções por jogador, marcação individual e bolas paradas.
- Estatísticas completas por temporada: artilharia, assistências, notas médias, prêmios de melhor do mês.

## 5. Gráficos da partida

- Estádio: arquibancada com público variável conforme lotação, placar eletrônico, holofotes, faixas, bandeirinhas e efeitos de clima (chuva, noite, tarde).
- Jogadores: pele/cabelo/altura variados, uniforme com número e nome, movimentação mais fluida, comemorações e reações de banco.
- Câmeras de TV com replay automático de gol, câmera lenta e placar em estilo transmissão.
- Ajuste automático de qualidade para celulares mais fracos.

## Detalhes técnicos

- Catálogo em `src/game/data/leagues.ts` (mesmo formato `Raw`), copas em novo `src/game/data/cups.ts` com chaveamento determinístico usando `makeRng`.
- Calendário: `src/game/season.ts` ganha rodadas de copa intercaladas; `advanceRound` em `src/game/career.ts` processa liga + copa na mesma semana.
- Importação: `importEverything` em `src/lib/football-sync.server.ts` passa a paginar internamente e gravar cursor em `import_runs`; rota `/api/public/sync-football?scope=all` continua a mesma entrada.
- Interface: novo shell em `src/components/game/GameShell.tsx` + componentes shadcn existentes; tokens de cor continuam em `src/styles.css` via `clubTheme`.
- 3D: melhorias em `src/components/game/Stadium3D.tsx` e `src/components/game/players/PlayerRig.tsx`, com níveis de qualidade já existentes.
- Entrega em etapas verificadas no navegador: (1) ligas e copas, (2) importação única, (3) interface, (4) mecânicas, (5) gráficos.
