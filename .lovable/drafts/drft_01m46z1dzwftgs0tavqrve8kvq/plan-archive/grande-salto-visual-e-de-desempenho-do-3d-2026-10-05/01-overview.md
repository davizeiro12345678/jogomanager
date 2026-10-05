# Grande salto visual e de desempenho do 3D

## Objetivo

Levar jogadores, partida e interface para uma direção **EA FC realista**, preservando **30 FPS estáveis em celulares comuns**. O trabalho será feito por camadas mensuráveis, sem trocar a engine nem adicionar bibliotecas redundantes.

As imagens enviadas serão a referência “antes”: hoje a silhueta está larga e rígida, ombros/quadril/transições das juntas parecem artificiais, mãos e pés são simplificados, o rosto tem pouca definição, o uniforme estica e a sombra fica grande e dura.

## Resultado esperado

- Jogadores próximos com anatomia atlética, rosto e cabelo mais naturais, mãos/pés proporcionais e melhor postura.
- Corrida, giro, domínio, passe, chute, dividida, defesa e comemoração com transições fluidas e contatos convincentes.
- Uniformes oficiais com padrão, escudo, gola, mangas, shorts, meias, nome e número legíveis sem multiplicar materiais por atleta.
- Jogadores médios e distantes muito mais baratos, preservando a silhueta e o ritmo do jogo.
- Estádio e transmissão mais ricos onde a câmera realmente mostra, sem gastar desempenho em áreas invisíveis.
- Interface da partida compacta, legível sobre qualquer cena, reorganizada no celular e sem disputar espaço com o campo.

## O que será preservado

- Three.js/R3F, Rapier, WebGL2 universal e WebGPU experimental com fallback.
- Simulação determinística e autoridade do Worker; física visual não altera resultados.
- Sistema atual de kits, texturas KTX2, materiais compartilhados, LOD e orçamento adaptativo.
- Preset Alto mantém sua qualidade; primeiro será removido desperdício, depois o orçamento recuperado será aplicado aos jogadores próximos.
