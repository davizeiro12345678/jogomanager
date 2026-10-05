# Clubes oficiais, novo visual da carreira, 3D, cenas e pacotes

Hoje, 95 dos 10.213 times oficiais importados estão ligados a um clube do jogo, e 1.372 dos 4.506 clubes têm escudo. O plano tem 5 etapas e faço uma por rodada para caber nos créditos.

## 1. Ligar os times oficiais aos clubes do jogo
- Comparar nomes sem acento, sem "FC/SC/CF/EC/Clube" e com apelidos conhecidos (ex.: "Man United" = "Manchester United"). Usar também país e liga para evitar clubes homônimos.
- Só ligar automaticamente quando houver um único candidato com alta confiança. Os casos duvidosos ficam numa lista para conferir, sem chute.
- Depois de ligar, copiar o escudo oficial e os uniformes da temporada mais recente (titular, reserva, terceiro e goleiro) para o clube.
- No jogo: o escudo aparece no lugar do escudo desenhado, e o uniforme oficial define as cores do 3D. Sem imagem, continua o visual atual.
- Relatório final: quantos clubes foram ligados, quantos ficaram duvidosos e quantos ganharam escudo e uniforme.

## 2. Novo visual das telas da carreira
- Reorganizar o estilo das telas da carreira (cerca de 2.500 linhas) em blocos: cabeçalho, cartões, tabelas, abas e barra inferior. Remover regras repetidas e cores fixas, que passam a usar as cores do tema.
- Tema "estádio à noite", com o clube como cor de destaque, títulos em Space Grotesk e textos em DM Sans.
- Hierarquia: o próximo jogo e a ação principal em destaque, depois a tabela e as notícias.
- No celular: barra inferior fixa, botões de 44px, nada saindo da tela. Também estados de carregando, vazio e erro.
- Conferir em 390px e 1280px, no Painel, Elenco, Tabela, Táticas e Mercado.

## 3. Partida 3D
- Menos desenhos por quadro: juntar placas, arquibancadas e refletores distantes; jogadores longe com corpo simplificado.
- Usar o que sobrar no que aparece de perto: rosto, cabelo, uniforme oficial com número, gramado próximo e rede reagindo ao gol.
- Medir antes e depois na mesma cena e câmera. Se não der para medir aqui, informo "não medido".

## 4. Cenas 3D
- Abertura noturna, túnel, replay do gol com 2 ângulos, intervalo, fim de jogo e taça. Todas usam o escudo e o uniforme oficiais.
- Todas podem ser puladas e respeitam a opção de reduzir animações. No celular e na qualidade Baixa, versão leve.

## 5. Pacotes
- Atualizar Three, os pacotes de 3D do React, Rapier, pós-processamento e o roteador para as versões estáveis mais recentes, rodando os testes depois.
- Adicionar 5 pacotes:
  1. **meshoptimizer**: deixa os modelos 3D menores e mais rápidos de carregar.
  2. **detect-gpu**: escolhe a qualidade inicial pelo aparelho, sem esperar o jogo travar.
  3. **r3f-perf**: painel de medição de desempenho, só no modo de teste.
  4. **@use-gesture/react**: gestos de toque melhores para a câmera e o menu.
  5. **simplex-noise**: vento suave no gramado, nas bandeiras e na torcida, sem custo alto.
- Física: o Rapier continua sendo a única biblioteca de física, e só para efeitos visuais. Não vou adicionar um segundo motor de física, porque isso quebraria a regra de partidas determinísticas.

## Detalhes técnicos
- Etapa 1: um script no servidor processa os times em lotes (sem duplicar nada se rodar de novo) e grava `official_teams.local_club_id`. Ele preenche `clubs.crest_url` e grava os uniformes em `kits` (por clube, temporada e tipo). Os casos duvidosos ficam marcados para revisão, não são ligados. Teste para a normalização dos nomes.
- Etapa 2: o arquivo `src/components/game/career-interface.css` é dividido em camadas, e as cores fixas viram as cores do tema em `styles.css`.
- Etapa 3: instancing/merge em `Stadium3D` e `CrowdLod`, LOD dos jogadores por tamanho na tela, e as texturas KTX2 dos uniformes.
- Etapa 5: a atualização dos pacotes só vale se o código checar sem erros e os 198 testes passarem. Se algum pacote quebrar, ele volta para a versão anterior.
- Ordem: 1, 2, 3, 4, 5. Cada etapa termina com testes, verificação no navegador e atualização da lista de tarefas.
