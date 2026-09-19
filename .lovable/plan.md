# Ciclo de gráficos, indexação, treino e correção das ligas

Cinco frentes numa entrega só, mantendo tudo que já funciona.

## 1. Próximo ciclo de gráficos 3D

- Iluminação: refazer o conjunto sol + preenchimento + luz de recorte do estádio com intensidades coerentes por horário (tarde, fim de tarde, noite), evitando o visual "chapado" atual.
- Sombras: cascata melhor ajustada (área do mapa de sombra acompanhando a câmera), viés corrigido para acabar com listras no gramado e sombra de contato mais definida sob os jogadores.
- Texturas dos jogadores: pele com variação real de tom e brilho, tecido com trama visível e desgaste, meias e chuteiras separadas do corpo, números e escudo mais nítidos de perto.
- Pós-processamento: brilho seletivo só nos refletores e na bola, oclusão de contato mais suave, leve granulação e correção de cor cinematográfica, tudo escalando pelos três níveis de qualidade.
- Cada mudança fica atrás do sistema de qualidade existente, então aparelho fraco continua leve.

Limite honesto: aqui só consigo validar sem placa de vídeo real. Vou medir quadros por segundo com o contador já existente e deixar tudo ajustável; a confirmação final em GPU real precisa ser feita por você no seu PC, e eu ajusto conforme o número que você me passar.

## 2. Indexação e textos das páginas

- Liberar para o Google e enviar no mapa do site: guia de carreira, táticas, scouting e a nova página de regras.
- Título e descrição únicos em cada uma, escritos para quem procura "jogo de manager", "formações", "olheiro" e "regras do futebol" — nada de descrição repetida.
- Nova página pública **/regras**: regras do futebol e como elas valem dentro do jogo (tempo, faltas, cartões, impedimento, substituições, pênaltis), com índice, blocos e perguntas frequentes, no mesmo padrão visual dos outros guias.
- As telas internas da carreira (com save do jogador) continuam fora do índice; quem é indexado é o conteúdo público.

## 3. Fase de treino

- Nova aba de treino ampliada: além do foco e intensidade atuais, exercícios de tática e formação (linha alta, saída de bola, bola parada, transição, compactação) que dão evolução real em atributos ligados à sua formação.
- Amistosos contra clubes reais do banco, com escolha de adversário por força, e opção de assistir em 3D ou simular.
- Desafio contra outra pessoa usando o multiplayer que já existe, entrando pelo mesmo lugar.
- Resultado do treino e dos amistosos alimenta forma, entrosamento e relatório da comissão técnica.

## 4. Criação do manager

- Fluxo em etapas claras (perfil, aparência, estilo de jogo, clube) com resumo e possibilidade de voltar.
- Mais opções de aparência e personalidade, com prévia maior e efeito de cada escolha explicado.
- Busca e filtros na escolha do clube (país, divisão, força, orçamento) em vez de lista longa.
- Funciona bem em celular.

## 5. Número de clubes por liga

Hoje dezenas de ligas estão com 8, 10 ou 14 clubes quando o campeonato real tem mais. Vou corrigir todas para o tamanho real, completando com clubes reais de cada país onde eu conheço os nomes e só gerando nome plausível onde faltar. Exemplos do que está errado: Rússia (12 → 16), Israel (10 → 14), Hungria (10 → 12), Bulgária (8 → 16), Eslováquia (8 → 12), Irlanda (8 → 10), Finlândia (8 → 12), Islândia (8 → 12), Chipre (8 → 14), e as segundas divisões e ligas asiáticas/africanas que estão em 8.

A tabela, o calendário e os rebaixamentos são recalculados a partir do tamanho da liga, então continuam certos depois da correção.

## 6. Interface

- Padronizar cabeçalho, espaçamento e tipografia entre painel, elenco, táticas, treino e loja.
- Painel do clube (a tela das fotos) reorganizado: próximo jogo em destaque, alertas de lesão mais legíveis, finanças resumidas em cartões claros.
- Navegação superior com rolagem em telas estreitas, foco visível no teclado e contraste conferido.

## Detalhes técnicos

- Gráficos em `src/components/game/Stadium3D.tsx`, `src/components/game/post/`, `src/components/game/players/PlayerRig.tsx` e as texturas em `src/game/textures` / `src/components/game/stadium/textures`, sempre respeitando os níveis de qualidade e `detectQualityByGpu()`.
- SEO: `src/routes/carreira.tsx` (guia público correspondente), `taticas-e-formacoes.tsx`, `guia-de-scouting.tsx`, nova `regras.tsx` com `ArticleShell`, entradas em `src/routes/sitemap[.]xml.ts`.
- Treino: `src/routes/training.tsx`, `src/game/season-mode.ts`, `src/game/career.ts` e reuso de `quickMatch.ts` / `multiplayer`.
- Ligas: `src/game/data/leagues.ts`, `leagues-extra.ts`, `leagues-world.ts`; testes conferindo que cada liga tem tamanho par e calendário válido.
- Validação: testes do simulador, verificação de tipos, compilação e checagem no navegador das telas alteradas.

## Fora do alcance

- Medição de quadros por segundo em placa de vídeo física (precisa do seu aparelho).
- Elencos completos dos 415 clubes brasileiros (depende de chave paga da fonte de dados).
