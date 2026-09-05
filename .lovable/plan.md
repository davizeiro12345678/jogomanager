# Mega atualização: mundo real, engine, gráficos, narração e 39 idiomas

## 1. Mais ligas e clubes (uma única importação)

- Novo catálogo `src/game/data/leagues-world.ts` no mesmo formato dos atuais, com cerca de 25 novas competições e ~300 clubes (Escócia 2ª divisão, Irlanda, País de Gales, Islândia, Chipre, Malta, Eslovênia, Eslováquia, Letônia, Lituânia, Estônia, Geórgia, Armênia, Azerbaijão, Cazaquistão, Uzbequistão, Índia, Vietnã, Malásia, Chile 2ª, Uruguai 2ª, Colômbia 2ª, América Central, Angola, Tunísia e Quênia).
- `leagues.ts` passa a espalhar também esse catálogo; a lista de campeonatos, a busca de liga e a página pública de ligas mostram tudo automaticamente.
- Mapeamento de escudos: tabela por prefixo de país que define forma do escudo, padrão e emblema padrão de cada nova liga, para os clubes novos não caírem no visual genérico.
- Uma única rodada de importação dos dados reais (clubes, escudos, kits) para o banco, em lotes, sem alterar o endpoint existente.

## 2. Movimentação e engine

- Passos reais: velocidade do corpo passa a alimentar o comprimento e a cadência da passada, com pé de apoio travado no chão (sem escorregar).
- Curva de corrida: aceleração, desaceleração e raio de curva por jogador (jogador rápido vira mais lento), com inclinação do corpo na curva.
- Reação ao chute: quem está perto se abaixa, desvia ou salta; goleiro antecipa a direção; defensores fecham a linha de passe; todos reagem ao rebote.
- Bola: efeito (curva), quique com altura real e rolamento com atrito da grama.
- Ajustes de disputa: mais duelos, cruzamentos, contra-ataques e faltas próximas à área.

## 3. Gráficos: estádio, grama, jogadores, torcida

- Grama: sombra de fibra, marcas de corte, desgaste e pisadas que aparecem durante o jogo.
- Torcida: multidão em camadas com cores do clube, bandeiras, ondas, aplauso e reação ao gol.
- Estádio: arquibancada em anéis, cobertura, holofotes, placar, faixas e público variável conforme o tamanho do clube.
- Jogadores: melhor acabamento de rosto, cabelo, uniforme e chuteiras, com nível de detalhe por distância da câmera.
- Shaders e pós-processamento: brilho controlado, correção de cor tipo transmissão de TV, vinheta suave, névoa de estádio e reflexo úmido no gramado — tudo com modo leve para celular.

## 4. Interface, painéis e animações

- Painéis do jogo com cabeçalho fixo, cartões com profundidade, indicadores e gráficos mais legíveis.
- Transições animadas entre telas, contadores que sobem, destaque de gol, notificações deslizantes e feedback ao tocar.
- Placar e HUD da partida redesenhados, com linha do tempo dos lances e eventos animados.

## 5. Narração

- Narração falada dos lances (gol, defesa, falta, substituição, fim de jogo) usando a voz do próprio navegador, no idioma escolhido.
- Botão de ligar/desligar narração e volume, com fallback silencioso quando o dispositivo não tem voz para o idioma.

## 6. 39 idiomas com detecção automática

- Sistema de tradução próprio e leve, com detecção pelo idioma do navegador e opção de trocar manualmente (a escolha fica salva).
- 39 idiomas: português (BR/PT), inglês, espanhol, francês, alemão, italiano, holandês, polonês, russo, ucraniano, turco, árabe, hebraico, japonês, coreano, chinês (simplificado e tradicional), hindi, bengali, indonésio, malaio, tailandês, vietnamita, filipino, sueco, norueguês, dinamarquês, finlandês, tcheco, eslovaco, húngaro, romeno, búlgaro, grego, croata, sérvio, persa, suaíli e africâner.
- Direita-para-esquerda para árabe, hebraico e persa; números, datas e valores no formato local.
- Páginas públicas continuam em português para não perder o tráfego de busca já conquistado; a tradução cobre as telas do jogo.

## Detalhes técnicos

- Novo `src/game/data/leagues-world.ts` + spread em `LEAGUES`; escudos via mapa de país em `Crest.tsx`.
- `sim.ts`: velocidades em m/s já implantadas ganham aceleração/raio de curva; novos estados de reação a chute; `PlayerRig.tsx` sincroniza passada com velocidade (foot-lock por fase de ciclo).
- `Stadium3D.tsx`: shaders de grama/torcida em `onBeforeCompile`, pós-processamento por qualidade (`@react-three/postprocessing` já instalado), instancing para torcida.
- i18n: `src/i18n/` com dicionários por idioma carregados sob demanda, provider no `__root.tsx`, hook `useT()`; sem novas dependências pesadas.
- Narração: Web Speech API, ligada aos eventos de `sim.events`.
- Validação: `bunx tsgo --noEmit`, partida completa fora do navegador (placares realistas) e captura de tela do `/match`.
