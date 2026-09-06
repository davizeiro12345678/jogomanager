# Grande atualização: offline, gráficos, multiplayer e conteúdo

Continuação das cinco frentes já aprovadas, mais o modo offline completo, um salto visual novo e polimento profundo de interface.

## 1. Jogar offline (prioridade)

Hoje a carreira só é guardada no armazenamento do navegador de forma simples e, se você estiver com conta, cada alteração tenta ir para a nuvem na hora — sem internet isso falha em silêncio.

- Guardar a carreira em um banco local do navegador (mais espaço e mais seguro que hoje), com histórico das últimas 10 versões para recuperar em caso de erro.
- Fila de envio: tudo que acontecer sem conexão fica gravado e é enviado sozinho assim que a internet voltar, com aviso discreto "salvo no aparelho / sincronizado".
- Resolução de conflito por data: se a nuvem tiver algo mais recente, você escolhe qual versão manter.
- Instalação como aplicativo (ícone na tela inicial) e cache das telas, escudos, camisas e elencos já visitados, para abrir e jogar partidas completas sem rede.
- Partidas, treinos, mercado e temporada automática passam a rodar 100% no aparelho; só o chat, a loja e o multiplayer exigem conexão e mostram aviso claro quando offline.

## 2. Seis novas bibliotecas visuais

Três dimensões: aceleração de colisões e sombras de contato, oclusão de ambiente realista, texto tridimensional nítido (números nas costas, placar, painéis de publicidade), materiais com sombreamento próprio, física real da bola e rastros luminosos.
Site: animações de transição suaves e efeitos de comemoração.

Todas são bibliotecas consolidadas e leves, ativadas por nível de qualidade para não pesar em celular.

## 3. Salto gráfico do estádio e dos jogadores

- Gramado: reflexo úmido variável, marcas de corte em diagonal, desgaste que aumenta ao longo da partida, respingos ao deslizar.
- Estádio: oclusão de ambiente, luzes volumétricas nos refletores, telão com replay real do lance, fumaça de sinalizador, publicidade animada.
- Torcida: mais variação de corpos e roupas, mosaicos por setor, ola mais orgânica, reação ao placar.
- Jogadores: rosto e cabelo simplificados por distância, número e nome nas costas em relevo, suor/brilho, sombra de contato, animações de comemoração e de falta.
- Bola com física real, efeito curva e rede que responde ao impacto.

## 4. Cutscenes

Câmeras com profundidade e movimento contínuo, camadas com paralaxe, iluminação por horário, trilha e efeitos sonoros curtos, expressões do treinador conforme o clima do vestiário, e novas cenas: sorteio de copa, coletiva pós-derrota, renovação de contrato, despedida de ídolo, título.

## 5. Interface e experiência

- Nova tela inicial do jogo com cartões grandes, atalhos e "continuar de onde parou".
- Barra lateral reorganizada por temas, busca rápida por comando, atalhos de teclado.
- Painéis de dados legíveis: gráficos de forma, mapa de calor do time, comparação de jogadores lado a lado.
- Modo claro/escuro afinado, tipografia maior, alvos de toque maiores no celular, animações de transição entre telas.
- Onboarding curto para quem chega pela primeira vez.

## 6. Mais clubes e elencos reais

Retomar a importação para cobrir as ligas ainda incompletas (escudos, estádios, camisas, elencos com idade, número e nacionalidade) e um painel simples mostrando o que já foi importado.

## 7. Multiplayer

Sala com código, lista de salas abertas, escolha de clube dos dois lados, prontidão, partida sincronizada minuto a minuto, chat da sala, reconexão automática, encerramento por abandono e histórico de confrontos.

## 8. Conteúdo, SEO e traduções

Novas páginas: melhores formações, guia de scouting, gestão financeira, glossário do futebol, como jogar offline, comparativo de jogos de manager. Cada uma com título e descrição próprios, dados estruturados e link no sitemap.
Traduções: completar as chaves faltantes nos idiomas atuais e ampliar a cobertura das telas novas.

## Detalhes técnicos

- Persistência: IndexedDB (`idb-keyval`) substituindo o localStorage em `careerStorage.ts`, com outbox e `navigator.onLine` + listeners; `useCareer.ts` passa a ler/escrever pela camada offline e a sincronizar via `saveCareer` quando online. Migração automática da chave `manager3d.career.v1`.
- PWA: manifest + service worker (`vite-plugin-pwa`) com estratégia stale-while-revalidate para assets e network-first para dados.
- Dependências 3D: `three-mesh-bvh`, `n8ao`, `troika-three-text`, `three-custom-shader-material`, `@react-three/rapier`, `meshline`; site: `motion` e `canvas-confetti`.
- Arquivos principais: `Stadium3D.tsx`, `stadium/`, `players/PlayerRig.tsx`, `post/PostFX.tsx`, `Cutscene.tsx`, `content/cutscenes.ts`, `GameShell.tsx`, `i18n/index.tsx`, novas rotas em `src/routes`, multiplayer sobre a tabela `match_rooms` já existente (Realtime).
- Tudo novo respeita os três níveis de qualidade e o detector de FPS já existente.

## Ordem de execução

1. Offline + PWA. 2. Dependências e gráficos do estádio/jogadores. 3. Cutscenes. 4. UI/UX. 5. Multiplayer. 6. Importação de clubes. 7. Páginas novas e traduções.
