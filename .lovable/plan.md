# Grande ciclo: erros, acesso das ligas, texturas KTX2, gráficos, cutscenes e design

A ordem é a que você escolheu: primeiro os erros, depois o acesso entre divisões, depois as texturas KTX2 e por fim o visual. Cada etapa cabe em até 12 créditos. No fim de cada uma, eu mostro o que foi verificado. O FPS real continua "não medido" até alguém testar num aparelho de verdade.

## Etapa 1 — Erros e inconsistências
- **"País de origem" repetido (o erro da sua imagem):** a lista mostra um botão por liga, então Brasil, Inglaterra, Espanha, Itália, Alemanha e França aparecem duas vezes. Ela vai mostrar cada país uma vez só, em ordem alfabética e com um campo de busca. A escolha do país deixa de depender de qual liga foi clicada.
- **Varredura de erros:** vou abrir as telas principais no celular e no computador: início, nova carreira, liga, elenco, loja, partida 3D e privacidade. Em cada uma, anoto textos cortados, rolagem para o lado, botões sem efeito, bandeiras ou nomes errados e erros no console. Tudo o que eu encontrar nessa lista será corrigido.
- **Partida 3D:** vou conferir se aparecem jogadores atravessando uns aos outros, câmera tremendo, placar desencontrado com os lances e tela preta ao entrar.

## Etapa 2 — Acesso e rebaixamento de verdade para as 178 ligas novas
- Cada país ganha uma escada completa de divisões. Exemplos: Série A, B, C e os três grupos da Série D no Brasil; Serie B, depois Serie C A/B e Serie D na Itália; LaLiga 2, depois Primera Federación e Segunda Federación na Espanha. O mesmo vale para Inglaterra, Alemanha, França, Portugal, Argentina e as demais.
- Para cada ligação entre divisões, defino quantos sobem e quantos descem. Quando uma divisão tem vários grupos embaixo, os campeões dos grupos sobem e os últimos descem, distribuídos entre os grupos.
- Os testes vão conferir: nenhum clube duplicado, todos os clubes continuam existindo e cada divisão mantém o mesmo tamanho depois de 10 temporadas.

## Etapa 3 — Texturas KTX2 de alta definição
- Um trabalho à parte transforma as texturas que o jogo desenha hoje ao carregar em arquivos de imagem de alta definição: gramado (com o padrão de corte, as linhas e o relevo), arquibancadas e concreto, rede e camisas, shorts e pele dos jogadores. Depois, esses arquivos são convertidos para o formato comprimido KTX2 e hospedados na nuvem do projeto.
- O jogo passa a carregar esses arquivos, com qualidade menor nos aparelhos mais fracos. Se um arquivo falhar, ele volta automaticamente para a textura atual, sem tela preta.

## Etapa 4 — Gráficos 3D
- Iluminação do estádio mais rica, com o brilho dos refletores e reflexos no gramado molhado à noite.
- Mais detalhes no estádio: placas de LED, bancos de reservas, túnel e refletores.
- Os jogadores próximos da câmera ganham rostos e cabelos melhores e mais contato dos pés com o chão.
- Tudo isso só no nível de qualidade mais alto e nos jogadores próximos, seguindo a regra "rodar bem antes de ficar bonito".

## Etapa 5 — Cutscenes
- **Abertura do jogo:** ao entrar no jogo, a câmera sobrevoa o estádio de noite, com o logotipo e o som da torcida.
- **Entrada em campo:** túnel, times perfilados, câmera passando pelos jogadores e mosaico da torcida.
- **Gols e replays:** comemoração, câmera lenta e 2 a 3 ângulos de replay.
- **Intervalo e fim de jogo:** placar animado com estatísticas e a reação da torcida.
- **Títulos:** entrega da taça, confete e festa do elenco.

## Etapa 6 — Simulação
- A partida 3D que você joga passa a gerar os mesmos lances da simulação rápida (minutos dos gols, pênaltis, expulsões), com narração e destaques.
- Revisão do posicionamento, da pressão e das finalizações, para acabar com chutes absurdos e jogadores parados.

## Etapa 7 — Design do jogo
- **Menus e navegação:** menu mais simples, com as telas agrupadas por tema e menos botões.
- **Celular:** barra inferior fixa, cartões que se reorganizam em telas pequenas e botões grandes o bastante para o dedo.
- **Visual geral:** cores, fontes e cartões com cara de jogo profissional e consistentes em todas as telas.
- **Dentro da partida:** placar mais limpo, painéis que podem ser recolhidos e controles que não cobrem o jogo.

## Detalhes técnicos
- Etapa 1: `src/routes/new.tsx` passa a mostrar a lista de países únicos, gerada a partir de `LEAGUES` e agrupada por `country`. A varredura usa Playwright.
- Etapa 2: `PYRAMID` em `src/game/pyramid.ts` ganha as ligações completas (vários grupos embaixo de uma divisão, repartição dos que sobem). Novo teste de 10 temporadas.
- Etapa 3: script com canvas no Node que exporta PNG 2K/1K e depois converte com `toktx`/basisu via `nix run`. Os arquivos sobem pelo `lovable-assets`. O carregamento usa o `KTX2Loader` do three, com os transcoders hospedados, e volta às texturas procedurais se falhar.
- Etapas 4 a 7: `Stadium3D`, `PlayerRig`, o sistema de cutscenes e o HUD existentes, sem trocar o motor gráfico e sem instalar bibliotecas novas.
