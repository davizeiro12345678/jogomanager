# Plano: conteúdo, velocidade, gráficos 3D e simulação

O pedido é grande, então vai em etapas. Cada etapa só termina depois de verificar antes e depois.

## Etapa 1 — Medir antes (linha de base)
- Rodar o Lighthouse no site publicado `https://jogomanager.com`, em celular e computador, na home, em /produtos, /criador e /perguntas-frequentes. Rodar 3 vezes e usar a mediana.
- Registrar LCP, INP/TBT, CLS, peso dos arquivos e acertos de cache do Cloudflare.
- Tirar capturas fixas, sempre com o mesmo ângulo, de uma cutscene (vestiário) e da partida 3D (Flamengo x Palmeiras).
- Registrar o tempo até a cena aparecer.

## Etapa 2 — Cache e entrega de arquivos
- Fazer arquivos com versão (JS, CSS, imagens, texturas 3D) ficarem guardados por 1 ano. As páginas em HTML ficam guardadas só por pouco tempo, com renovação em segundo plano.
- Conferir no Cloudflare as regras de cache para arquivos estáticos.
- Pré-carregar a imagem principal de cada página e servir em WebP/AVIF.
- Atrasar scripts que não são essenciais (analytics etc.).
- Medir de novo. Otimizar o que ficar abaixo de 98, sem prometer a nota antes de medir.

## Etapa 3 — Páginas Pacotes, Criador e FAQ
- Reescrever /produtos (Pacotes) e /criador com cerca de 2.500 palavras inéditas cada. Usar só dados reais do jogo: preços e benefícios do catálogo, recursos que existem.
- Incluir tabelas comparativas e título/descrição únicos.
- Expandir /perguntas-frequentes, a página de FAQ que já existe, em vez de criar outra duplicada:
  - Dezenas de perguntas reais sobre carreira, partida 3D, loja, salvamento e contas, agrupadas por tema.
  - Uma seção de busca no próprio FAQ.
  - Marcação FAQ para o Google, com o mesmo texto que aparece na página.
- Pedir a sua confirmação para qualquer fato que não estiver no projeto.

## Etapa 4 — Cutscenes 3D mais leves e fluidas
- Carregar a cena 3D antes de ela abrir, enquanto o jogador está no menu.
- Reaproveitar texturas e materiais entre as cenas.
- Reduzir efeitos pesados em celulares fracos.
- Medir os quadros por segundo e o tempo de abertura antes e depois.

## Etapa 5 — Partida 3D: gráficos, fluidez e física
- Mais detalhe só nos jogadores perto da câmera; os distantes ficam mais simples e baratos.
- Melhorar a grama de perto e as sombras.
- Bola com quique e efeito mais realistas.
- Jogadores que disputam corpo a corpo de forma visível, sem se atravessarem.
- Manter as regras da partida determinísticas: o mesmo jogo sempre dá o mesmo resultado.

## Etapa 6 — Inteligência de jogadores e treinadores
- Jogadores:
  - Melhor posicionamento sem a bola: linhas, cobertura e marcação.
  - Decisões de passe, chute e drible pesando o risco.
- Treinador: muda a tática durante o jogo pelo placar, cansaço e tempo, com substituições mais inteligentes.
- Validar com os testes de simulação e de estresse com 200 partidas.

## Etapa 7 — Relatório antes e depois
- Gerar um relatório com:
  - Tabelas de métricas: Lighthouse, LCP, CLS, INP, peso, quadros por segundo e tempo de abertura das cenas.
  - Capturas de antes e depois.
  - Contagem de palavras das páginas.
- Salvar o relatório em Files.
- Os números serão medidos de verdade. Os testes aqui rodam sem placa de vídeo, então os quadros por segundo de um celular real ficam marcados como não verificados.

## Detalhes técnicos
- Respeitar `docs/critical-performance.md`: o portão de desempenho, o estresse com 200 partidas e os orçamentos de bundle não podem ser afrouxados.
- A IA continua determinística no worker da simulação. O Rapier fica só no visual.
- Publicar ao final para medir o "depois" no site no ar.
