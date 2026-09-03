# Mega atualização: jogar sem login + gráficos, ligas, UI e conteúdo

## 1. Jogar sem e-mail (modo convidado)

- A home passa a ter um botão principal "Jogar agora" que cria a carreira imediatamente, sem conta.
- A carreira do convidado é salva no navegador (localStorage) com a mesma estrutura da carreira na nuvem.
- Login vira opcional: um aviso discreto ("salve na nuvem para jogar em outros aparelhos") com botão de criar conta.
- Ao entrar numa conta com carreira local existente, a carreira é enviada para a nuvem e o jogo continua de onde parou.
- Todas as telas (elenco, táticas, partida, mercado, diretoria, finanças, notícias, história, estatísticas, olheiros) funcionam igual nos dois modos.

## 2. Novas ligas e campeonatos

- Adicionar ~12 novas ligas nacionais (ex.: Escócia, Grécia, Áustria, Suíça, Dinamarca, Noruega, Suécia, Croácia, Sérvia, Japão, Coreia, Austrália) com elencos e escudos gerados.
- Adicionar competições continentais e copas nacionais com chaves eliminatórias integradas ao calendário e à sala de troféus.

## 3. Gráficos: estádio, jogadores, kits e escudos

- Estádio: arquibancadas em mais níveis, telão, fumaça/bandeirões da torcida, iluminação noturna melhor, clima (sol/chuva/noite) e desgaste do gramado.
- Jogadores: proporções corporais melhores, variação de tipo físico/pele/cabelo, números e nomes nas camisas, expressões de comemoração.
- Kits: padrões novos (listras, faixa, xadrez, degradê), meias/calções coerentes, uniforme reserva e goleiro distinto.
- Escudos: geração mais rica (formatos de escudo, faixas, estrelas, iniciais legíveis) e uso consistente em todas as telas.

## 4. UI/UX e conteúdo

- Painel inicial mais claro: próximo jogo em destaque, objetivos da diretoria, alertas (lesões, contratos, moral).
- Navegação com ícones, melhor uso em celular, estados de carregamento e vazios, feedback ao salvar.
- Mais conteúdo: notícias com contexto real da temporada, rivalidades, entrevistas pós-jogo simples que afetam moral, prêmios de fim de temporada.

## 5. Novas funcionalidades/mecânicas

- Substituições e ajustes táticos durante a partida ao vivo.
- Treino semanal com foco escolhido afetando forma e evolução.
- Empréstimos, cláusulas e renovações de contrato.
- Categorias de base gerando jovens promissores.
- Sala de troféus e histórico de temporadas expandidos.

## Detalhes técnicos

- Camada de persistência unificada (`src/game/storage.ts`): mesma API para localStorage (convidado) e tabela `careers` (autenticado), com migração automática ao logar.
- Rotas de jogo saem de `_authenticated/` para rotas públicas que leem a carreira da camada unificada; nada de chamadas de servidor protegidas em loaders públicos.
- Dados de ligas/clubes continuam determinísticos por seed, sem assets externos.
- Melhorias 3D seguem o pipeline atual (R3F + postprocessing), mantendo os modos Baixa/Média/Alta e sem soft shadows/depth of field (quebraram antes).
- Verificação: type-check estrito, build de produção e captura de tela do jogo em modo convidado.
