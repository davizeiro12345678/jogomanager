# Grande atualização: visual, cenas e base de dados

## Ponto importante antes de começar: trocar de motor 3D

Todo o 3D do jogo (estádio, jogadores, torcida, grama, escudos, cutscenes, pacotes da loja) roda hoje sobre um motor só — são cerca de 4.800 linhas nos arquivos principais e 15 arquivos que dependem dele. Trocar para Babylon.js significa reescrever tudo isso do zero: partida ao vivo, câmeras, iluminação, texturas procedurais, animação dos jogadores e as cutscenes. É um trabalho longo e, durante ele, o jogo fica instável.

Existe um caminho que entrega o mesmo ganho (WebGPU, imagem melhor, mais desempenho) sem parar o jogo: o motor atual já tem renderização WebGPU, com volta automática para o modo antigo em quem não tem suporte. Recomendo esse caminho e deixo Babylon como decisão sua.

Vou precisar da sua escolha nesse ponto antes de mexer no motor — o resto do plano abaixo independe dela e começa já.

## 1. Revisão visual das telas

- Partida ao vivo: placar, estatísticas e controles com mesmo espaçamento, mesma tipografia e retorno visual claro ao tocar; painel lateral no computador e gaveta no celular com a mesma linguagem.
- Carreira e elenco: cabeçalho padronizado, cartões de jogador com hierarquia (nome, posição, nota, condição), filtros e ordenação visíveis, estados de vazio e carregando.
- Loja: pacotes em grade consistente, preço e conteúdo destacados, confirmação e erro claros durante a compra.
- Transições suaves entre telas, respeitando quem prefere menos movimento.

## 2. Ampliar elencos e escudos

- Logo.dev para escudos em alta definição dos clubes sem imagem oficial.
- Firecrawl para páginas públicas de elenco dos clubes que faltam (415 clubes hoje sem jogadores).
- Perplexity para completar dados faltantes (posição, idade, nacionalidade) com fonte citada.
- Gravação em lote com indicador de progresso, sem duplicar jogadores já existentes e sem sobrescrever dados editados pelo usuário.

## 3. Cutscenes e cenas híbridas

- 25 novas cutscenes: chegada do ônibus, aquecimento, preleção, sorteio, hino, entrada da torcida, bandeirão, gol comemorado, pênalti decisivo, cartão vermelho, substituição, lesão, intervalo, coletiva, taça erguida, entre outras.
- 25 cenas híbridas (3D em tempo real + camadas cinematográficas) ligadas à identidade real do clube: cores, escudo, uniforme e estádio.
- Câmera cinematográfica contínua, cortes suaves, carregamento antecipado para não travar.

## 4. Animações e arquivos centrais

- PlayerRig: mais estados (parado, trote, corrida, disputa, chute, comemoração, queda, levantar) com transição suave entre eles e sem tremor.
- PostFX: efeitos ajustados por nível de qualidade, sem custo em máquinas fracas.
- Crest: escudos mais nítidos, com imagem oficial quando existir e desenho procedural melhor quando não existir.

## 5. Verificação

Compilação, verificação de tipos, teste no navegador das telas revisadas e das cutscenes, e relatório final do que ficou de fora.

## Detalhes técnicos

- Migração Babylon.js exigiria reescrever `Stadium3D.tsx` (2.381 linhas), `PlayerRig.tsx` (1.134), `Cutscene.tsx` (860), `PostFX.tsx`, `Crest.tsx`, `PackScene.tsx`, `Props.tsx` e os 8 módulos de texturas procedurais, além de substituir `@react-three/fiber`, `drei`, `postprocessing` e `rapier`.
- Alternativa recomendada: `WebGPURenderer` do three.js com fallback WebGL2, mantendo o grafo de cena atual; ganho principal em instancing e compute, sem reescrita.
- Importação de dados continua em `src/lib/football-sync.server.ts`, somando as fontes Logo.dev, Firecrawl e Perplexity às existentes.
