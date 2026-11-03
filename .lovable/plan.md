# Plano: velocidade 98+, conteúdo para o AdSense, 3D mais fluido e partida mais inteligente

## Objetivo e como saberemos que deu certo

| Área | Meta | Como provar |
|---|---|---|
| Velocidade (Lighthouse, celular) | 98 ou mais na home, /produtos, /criador e /perguntas-frequentes | Mediana de 3 rodadas no site publicado, antes e depois |
| Core Web Vitals | LCP abaixo de 1,8 s, CLS abaixo de 0,05, TBT abaixo de 150 ms | Mesmo relatório Lighthouse |
| Cache | Mais de 90% de acerto no Cloudflare para arquivos estáticos | Cabeçalho `cf-cache-status: HIT` em uma amostra de arquivos |
| Conteúdo | Pacotes e Criador com cerca de 2.500 palavras inéditas cada; FAQ com mais de 60 perguntas reais | Contagem automática de palavras e checagem de duplicidade entre páginas |
| Cutscenes | Abrir em menos da metade do tempo atual, sem quadro branco e sem travar | Tempo até a cena aparecer, medido antes e depois, mais capturas no mesmo ângulo |
| Partida 3D | Menos chamadas de desenho e menos picos de travamento, com o visual igual ou melhor | Contador do renderizador e amostra de quadros, mais capturas comparativas |
| Simulação | Jogadas mais realistas, sem quebrar o resultado determinístico | Testes da simulação e de 200 partidas aprovados, mais métricas do jogo |

Regra fixa: nenhum número entra no relatório sem ter sido medido. O que não der para medir aqui, como os quadros por segundo em celular real, fica marcado como "não verificado".

## Ordem de execução (do maior ganho para o menor risco)

### Fase 1 — Medir antes (sem mexer em nada)
- Lighthouse para celular e computador nas 4 páginas, 3 rodadas cada, guardando os relatórios.
- Lista dos 15 maiores arquivos baixados e do estado de cache de cada um.
- Capturas fixas para comparar depois:
  - cutscene do vestiário, cenas 1 a 4;
  - partida Flamengo x Palmeiras, no minuto 1 e em um lance perto do gol.
- Tempo de abertura da cutscene e da partida.
- Métricas da simulação, com sementes fixas:
  - passes certos;
  - chutes no alvo;
  - distância média entre as linhas do time;
  - número de jogadores sobrepostos.

### Fase 2 — Velocidade e cache (maior ganho, baixo risco)
- Arquivos com versão (JS, CSS, imagens, texturas 3D): cache de 1 ano marcado como imutável.
- HTML: cache curto, com renovação em segundo plano.
- Conferir que o Cloudflare respeita essas regras.
- Imagem principal de cada página em AVIF/WebP, no tamanho certo e pré-carregada.
- Analytics e scripts que não são essenciais carregam só depois que a página aparece.
- Nada de 3D é baixado nas páginas de conteúdo.
- Fontes: só os pesos usados, já pré-carregados.
- Medir de novo e corrigir item por item o que impedir os 98.

### Fase 3 — Conteúdo inédito para o AdSense
- **/produtos (Pacotes):** com base nos preços e benefícios reais do catálogo:
  - tabela comparativa dos 10 pacotes;
  - tabela "quanto vale cada moeda";
  - para quem cada pacote serve;
  - perguntas sobre pagamento seguro e reembolso.
- **/criador:** guia completo de criação de clube e treinador, com:
  - passo a passo;
  - tabela de atributos e efeitos;
  - exemplos de estratégias de carreira.
- **/perguntas-frequentes:** mais de 60 perguntas reais divididas em 8 temas: carreira, partida 3D, táticas, loja, contas, salvamento, desempenho e celular.
  - Cada tema ganha o próprio título e um índice no topo.
  - Busca instantânea entre as perguntas.
  - Marcação FAQ para o Google, com o mesmo texto que aparece na tela.
- Cada página ganha título e descrição únicos e links para as outras páginas.
- Uma checagem automática garante que nenhum parágrafo se repete entre páginas.
- Qualquer fato que não estiver no projeto, como prazo de reembolso, vira pergunta para você antes de publicar.

### Fase 4 — Cutscenes 3D
- Pré-carregar a cena enquanto o jogador está no menu.
- Reaproveitar texturas e materiais entre as cenas, em vez de recriá-los.
- Preparar os efeitos de imagem antes da primeira cena, eliminando o travamento no primeiro quadro.
- Em celulares fracos, desligar efeitos caros e manter a iluminação.
- Verificar as piscadas brancas cena a cena, com capturas.

### Fase 5 — Partida 3D: gráficos e fluidez
- Jogadores perto da câmera ganham mais detalhe; os distantes ficam mais leves.
- Grama mais rica de perto; sombras em níveis (perto, médio, longe).
- Bola com rotação e quique mais realistas, e contato do pé alinhado com a bola.
- Eliminar o aviso de textura que aparece no console durante a partida.
- Reduzir chamadas de desenho da torcida e do estádio, sem perder qualidade no modo "alta".

### Fase 6 — Física e inteligência
- Física:
  - aceleração e freada por atributo físico;
  - viradas de direção mais reais;
  - disputas de ombro;
  - trave, rede e jogadores sólidos.
- Jogadores:
  - linha defensiva compacta e coberturas;
  - movimentação para receber a bola;
  - passe, chute e drible decididos pelo risco e pelo espaço livre.
- Treinador:
  - muda a tática pelo placar, tempo e cansaço;
  - faz substituições inteligentes;
  - reage a cartão e a lesão.
- Tudo calibrado contra as métricas da Fase 1, para não ficar irreal.

### Fase 7 — Publicar, medir depois e entregar o relatório
- Publicar e repetir exatamente as medições da Fase 1.
- Relatório em PDF salvo em Files, com:
  - tabela antes e depois de cada métrica;
  - capturas lado a lado;
  - contagem de palavras;
  - o que melhorou, o que não melhorou e por quê.

## Detalhes técnicos
- Respeitar `docs/critical-performance.md`: as 200 partidas de estresse, os orçamentos de bundle, os contratos gráficos e o lint sem avisos não podem ser afrouxados.
- A simulação continua determinística no worker. O Rapier continua só no visual.
- As mudanças de IA e física entram com testes novos por regra, por exemplo: "trave empurra o jogador para fora" e "o treinador troca o atleta cansado depois dos 60 minutos".
- O Lighthouse aqui roda sem placa de vídeo. A medição oficial é a do site publicado.
