# Grande ciclo: erros, acesso das ligas, texturas KTX2, gráficos, cutscenes, simulação e design

A ordem segue a sua escolha: primeiro os erros, depois o acesso entre divisões, depois as texturas KTX2 e por fim o visual. Cada etapa cabe em até 12 créditos. Ao terminar cada uma, entrego:
- o que mudou;
- como verifiquei (testes, prints de celular e de computador, console limpo);
- o que ficou "não medido".

O FPS real continua "não medido" até ser testado num aparelho físico. Regras que valem para tudo:
- rodar bem antes de ficar bonito;
- nada de Babylon.js;
- nenhuma biblioteca nova sem um gargalo comprovado;
- detalhes pesados só no nível de qualidade Alto e nos jogadores perto da câmera.

---

## Etapa 1 — Erros e inconsistências (prioridade máxima)

**1.1 País de origem repetido (o erro da sua imagem)**
- Causa confirmada: a lista mostra um botão por liga. Por isso Brasil, Inglaterra, Espanha, Itália, Alemanha e França aparecem duas ou três vezes.
- Correção: cada país aparece uma vez só, em ordem alfabética, com um campo de busca e o Brasil fixado no topo. A escolha passa a guardar o país, e não uma liga qualquer daquele país.
- O mesmo problema de listas repetidas será procurado e corrigido na escolha de clube, nos filtros de transferências, no ranking e nas telas de competições.

**1.2 Varredura completa de erros de tela e de uso**
- Telas percorridas no celular (390px), no tablet (768px) e no computador (1280px): início, nova carreira (todas as etapas), escolha de clube, painel, elenco, card do jogador, táticas, treino, transferências, liga e tabela, copas, calendário, loja, conta, privacidade, regras, ranking e partida 3D.
- Em cada tela procuro:
  - textos cortados ou sobrepostos;
  - rolagem para o lado;
  - botões que não fazem nada;
  - bandeiras, escudos ou nomes errados;
  - telas vazias sem explicação;
  - carregamento infinito;
  - erros no console;
  - contraste ruim;
  - elementos sem acesso pelo teclado.
- Tudo o que for encontrado entra numa lista e é corrigido na mesma etapa. Se a lista passar dos 12 créditos, o restante vira a primeira tarefa da Etapa 2.

**1.3 Erros na partida 3D**
- Jogadores atravessando uns aos outros ou o goleiro.
- Bola presa, atravessando a rede ou quicando sem sentido.
- Câmera tremendo, entrando na arquibancada ou perdendo a bola.
- Placar do painel diferente dos gols que aconteceram.
- Tela preta ou travada ao entrar, pausar, voltar à partida ou trocar de aba.
- Uniformes com cores iguais nos dois times.

**1.4 Inconsistências de dados**
- Clubes em duas ligas ao mesmo tempo, jogadores sem posição, idades absurdas, overall fora de 40–99, estádios sem nome e competições sem campeão ao fim da temporada.
- A verificação de fim de temporada passa a corrigir sozinha os casos seguros (por exemplo, recalcular os pontos) em vez de só avisar.

---

## Etapa 2 — Acesso e rebaixamento de verdade para as 178 ligas novas

**2.1 Pirâmides completas por país**
- Brasil: Série A → B → C → três grupos da Série D.
- Itália: Serie A → B → Serie C (grupos A e B) → Serie D.
- Espanha: LaLiga → LaLiga 2 → Primera Federación → Segunda Federación → 14 grupos da Tercera Federación.
- Inglaterra: Premier → Championship → League One → League Two → National League → divisões regionais.
- Alemanha: Bundesliga → 2. Bundesliga → 3. Liga → Regionalligas.
- Também entram: França (National e National 2), Portugal (Liga 3 e Campeonato de Portugal), Holanda, Argentina (Primera Nacional), EUA (MLS Next Pro), Coreia (K League 2), Bolívia e os demais países com mais de uma divisão.

**2.2 Regras de sobe e desce**
- Cada ligação entre divisões tem sua quantidade de clubes que sobem e que descem, igual à da competição real.
- Quando há vários grupos embaixo de uma divisão, os campeões dos grupos sobem e os últimos de cima são repartidos entre os grupos por região ou por sorteio determinístico.
- Todas as divisões são processadas ao mesmo tempo: um clube pode cair da B para a C enquanto outro sobe da C para a B.

**2.3 Tela e notícias**
- A tabela ganha faixas coloridas para acesso, playoff, vaga continental e rebaixamento.
- No fim da temporada aparecem as notícias "Subiram" e "Caíram" de cada divisão.
- A tela de escolha de clube passa a mostrar a divisão atual de cada clube.

**2.4 Garantias com testes**
- 10 temporadas simuladas seguidas, conferindo:
  - nenhum clube duplicado;
  - nenhum clube desaparecido;
  - cada divisão mantém o mesmo número de clubes;
  - todo campeão de divisão inferior sobe;
  - todo lanterna desce.

---

## Etapa 3 — Texturas KTX2 de alta definição

**3.1 O que é substituído**
- **Gramado:** padrão de corte em faixas, variação de cor, desgaste na pequena área e no meio-campo, linhas pintadas e relevo.
- **Estádio:** concreto, cadeiras coloridas por setor, telhado metálico e placas.
- **Rede:** trama da rede com transparência.
- **Jogadores:** tecido da camisa, shorts e meiões com trama, número e relevo, além de pele com poros suaves.

**3.2 Como é feito**
- As texturas que o jogo hoje desenha ao carregar são exportadas em alta resolução (2K para o gramado e as camisas, 1K para o resto), incluindo os mapas de relevo e de brilho.
- Os arquivos são convertidos para KTX2, que são menores e mais rápidos para a placa de vídeo, e hospedados na nuvem do projeto.
- Três níveis de qualidade: Alto usa 2K, Médio 1K e Baixo 512px.
- Se o aparelho não suportar KTX2 ou um arquivo falhar, o jogo usa automaticamente a textura atual, sem tela preta.
- As camisas continuam com as cores de cada clube: a textura KTX2 traz a trama e o relevo, e a cor é aplicada por cima.

**3.3 Verificação**
- Prints antes e depois na mesma câmera.
- Tamanho total do download antes e depois.
- Console sem erros.
- Teste no nível Baixo.

---

## Etapa 4 — Gráficos 3D

**4.1 Iluminação**
- Refletores com um halo suave e sombras mais nítidas nos jogadores próximos.
- Reflexo discreto no gramado molhado à noite e céu com gradiente e nuvens no entardecer.
- Clima: chuva leve com gotas perto da câmera, que desliga no nível Baixo.

**4.2 Estádio**
- Placas de LED animadas ao redor do campo.
- Bancos de reservas com técnicos, túnel, bandeirinhas de escanteio que balançam, gandulas e câmeras de TV.
- Arquibancadas com mais variedade de torcedores, bandeiras e fumaça colorida em clássicos.

**4.3 Jogadores**
- De perto: rosto com mais formas, 6 estilos de cabelo, chuteiras coloridas, braçadeira do capitão e luvas do goleiro.
- Pés travando no chão durante a passada (menos "patinação").
- Sujeira e suor aparecendo ao longo da partida.

**4.4 Bola e rede**
- Bola com gomos em alta definição e rotação coerente com o chute.
- A rede balança quando sai o gol.

**4.5 Desempenho**
- Tudo com níveis de qualidade. O Baixo fica igual ou mais leve que hoje.
- Contagem de chamadas de desenho e de triângulos antes e depois, pelo painel de FPS.

---

## Etapa 5 — Cutscenes

**5.1 Abertura do jogo (primeira tela)**
- Sobrevoo noturno do estádio, com os refletores acendendo um a um, logotipo, som crescente da torcida e o botão "Jogar".
- Pode ser pulada e aparece em versão curta a partir da segunda visita.

**5.2 Entrada em campo**
- Câmera no túnel, crianças acompanhando os jogadores, times perfilados e câmera passando pelo rosto de cada titular.
- Mosaico ou bandeirão da torcida da casa, aperto de mãos e cara ou coroa.

**5.3 Gols e replays**
- Comemoração variada por jogador (corrida até a bandeirinha, deslize de joelhos, abraço coletivo).
- Explosão da torcida e fumaça.
- Replay com 2 ou 3 ângulos (atrás do gol, lateral, câmera lenta no chute) e placar animado.

**5.4 Intervalo e fim de jogo**
- Jogadores indo para o vestiário e painel animado de estatísticas (posse, chutes, passes e nota dos jogadores).
- No fim, a reação da torcida muda conforme o resultado: aplausos, vaias ou festa.

**5.5 Títulos**
- Pódio, entrega da taça ao capitão, confete nas cores do clube, fogos, volta olímpica e foto oficial do elenco.

**5.6 Regras de todas as cutscenes**
- Todas podem ser puladas, e pular leva ao mesmo resultado final.
- Respeitam o modo de movimento reduzido.
- Faixas pretas de cinema que se adaptam ao celular.
- Narração e som sincronizados por marcos de tempo, não por esperas soltas.

---

## Etapa 6 — Simulação

- A partida 3D que você joga passa a gerar os mesmos lances da simulação rápida (minuto dos gols, pênaltis, gols contra e expulsões), com narração em cada lance e um resumo de melhores momentos no fim.
- Posicionamento tático coerente com a formação escolhida: linhas compactas, laterais apoiando e volantes cobrindo.
- A pressão aumenta perto do fim quando o time está perdendo, e o time que ganha passa a administrar o resultado.
- Chutes com escolha mais realista (distância, ângulo e marcação) e goleiros que saem nos cruzamentos.
- Faltas, cartões e impedimentos visíveis na partida 3D.
- As substituições refletem o cansaço dos jogadores.
- Teste de estresse com 2.000 partidas conferindo:
  - média de gols;
  - taxa de empates;
  - vantagem de jogar em casa;
  - nenhuma partida travada;
  - placar igual aos lances.

---

## Etapa 7 — Design do jogo

**7.1 Identidade**
- Um único visual de jogo profissional, com o tema de estádio à noite que já existe: verde-gramado, detalhes em dourado e fontes esportivas condensadas para títulos e números.
- Cartões, botões, abas e selos padronizados em todas as telas, sem cores soltas.

**7.2 Navegação**
- Menu reorganizado em 5 áreas: Início, Clube (elenco, táticas, treino), Mercado, Competições e Loja.
- Caminho de volta sempre visível e, no computador, atalhos de teclado.

**7.3 Celular**
- Barra inferior fixa com as 5 áreas.
- Tabelas que viram cartões em telas pequenas e botões de pelo menos 44px.
- Janelas que abrem de baixo para cima e nada de rolagem para o lado.

**7.4 Dentro da partida**
- Placar compacto no topo e controles de tática, substituição e velocidade num painel que pode ser recolhido.
- Os lances aparecem como avisos curtos que não cobrem a bola.
- No celular, controles na parte de baixo, ao alcance do polegar.

**7.5 Estados das telas**
- Todas as telas com carregamento em esqueleto, mensagem de vazio com o próximo passo e mensagem de erro com botão de tentar de novo.

---

## Detalhes técnicos

- **1.1:** `src/routes/new.tsx` gera a lista de países únicos a partir de `LEAGUES`, agrupando por `country` e usando o primeiro id da liga como bandeira. O estado passa a guardar o país.
- **1.2–1.3:** varredura com Playwright em 3 larguras, gravando prints e o console. Os lances da partida são conferidos por testes determinísticos em `sim.ts`.
- **1.4:** `checkSeasonIntegrity` ganha a correção segura dos casos simples.
- **2:** `PYRAMID` em `src/game/pyramid.ts` passa a aceitar vários grupos embaixo de uma divisão, com repartição determinística dos clubes. Faixas de posição passam para `league.tsx`. Novo teste de 10 temporadas.
- **3:** script no Node que exporta os canvases procedurais atuais para PNG, conversão com `toktx`/basisu via `nix run` e upload pelo `lovable-assets`. Carregamento pelo `KTX2Loader` do three (já presente no pacote, não é biblioteca nova), com os transcoders hospedados, escolha por nível de qualidade e volta às texturas procedurais se falhar.
- **4–5:** evolução de `Stadium3D`, `PlayerRig`, `LowPlayers` e do sistema de cutscenes atual, com uma timeline por marcos. Efeitos com limites máximos e níveis de qualidade.
- **6:** `sim.ts` passa a emitir eventos no mesmo formato de `quickSimulate`. A narração consome esses eventos.
- **7:** tokens em `src/styles.css`, variantes dos componentes shadcn e barra inferior no layout raiz.
