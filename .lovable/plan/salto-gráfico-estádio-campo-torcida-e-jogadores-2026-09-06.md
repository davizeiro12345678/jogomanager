# Salto gráfico: estádio, campo, torcida e jogadores

Objetivo: o jogo parecer transmissão de TV — campo com camadas de textura de verdade, estádio construído por partes, torcida densa e viva, jogadores com corpos e movimento mais críveis — sem perder fluidez no celular. E arrumar a organização dos arquivos, hoje concentrada num único arquivo gigante do estádio.

## 1. Reorganizar os arquivos do 3D

O estádio inteiro vive hoje em um só arquivo de ~1.900 linhas. Vou quebrá-lo em partes com nome claro, sem mudar o que aparece na tela:

```text
src/components/game/stadium/
  Pitch.tsx        campo, linhas, marcas de corte, grama 3D
  Goals.tsx        traves, redes, bandeirinhas
  Structure.tsx    arquibancadas, cobertura, túneis, escadas
  Crowd.tsx        torcida, bandeiras, mosaicos
  Lighting.tsx     refletores, céu, dia/entardecer/noite
  Props.tsx        bancos, placas de publicidade, placar
  textures/        geradores de textura (grama, rede, placas)
src/components/game/post/
  PostFX.tsx       pós-processamento por qualidade e por momento
src/game/device.ts  orçamentos e qualidade adaptativa (já existe, ampliado)
```

O `Stadium3D.tsx` fica só como montagem da cena.

## 2. Campo em alta definição

- Grama em camadas: cor de base com variação, microfibras, relevo (normal), rugosidade, faixas de corte com bordas irregulares e desgaste mais forte nas áreas e nos círculos de maior uso.
- Brilho úmido rasante (a grama brilha quando a luz bate de lado), vento suave contínuo e achatamento das lâminas perto da bola e dos jogadores.
- Lâminas 3D só na região próxima da câmera; o resto usa a textura.
- Linhas mais nítidas, com leve desgaste; solo externo, bancos, bandeirinhas e traves refeitos.
- Rede reage ao impacto da bola com ondulação, sem custo pesado.

## 3. Estádio mais real

- Anéis de arquibancada com corredores, escadas, túneis e vãos; materiais distintos com sujeira e desgaste variando por setor.
- Cobertura com estrutura visível e reflexo suave; placas LED com brilho controlado.
- Torcida em setores instanciados: mais densa, com variação de roupa por setor do clube, movimento de onda e mosaico atualizando só onde a câmera olha.
- Dia, entardecer e noite refinados (cor do céu, sombras, temperatura da luz, refletores acesos só à noite/entardecer).

## 4. Pós-processamento de transmissão

- Alta: correção de cor, brilho seletivo só em fontes luminosas, vinheta, antisserrilhamento; desfoque de profundidade apenas no replay do gol.
- Média: correção de cor + brilho leve em resolução reduzida.
- Baixa/celular: uma única passagem de cor, sem brilho, ruído ou desfoque.
- Exposição ajustada para não estourar grama, placas e uniformes.

## 5. Jogadores mais críveis

- Proporções revistas (ombros, tronco, quadril, pernas), pele e cabelos com mais variação, luvas de goleiro, número nas costas legível.
- Corrida com passada real e inclinação nas curvas, chute com preparação e finalização, defesa do goleiro, comemoração; sombra colada ao chão.
- Três níveis de detalhe conforme a distância da câmera, com geometrias e materiais compartilhados entre todos os jogadores.

## 6. Fluidez

- Qualidade que se ajusta sozinha pelo ritmo real dos quadros (já existe) mais resolução dinâmica limitada no celular, orçamento explícito de peças por nível, pausa de atualizações fora do campo de visão e modo de proteção contra aquecimento.
- Metas: menos de 100 chamadas de desenho, resolução móvel entre 0,7 e 1,25, sombras só quando valem a pena, no máximo 2 passagens de efeito.

## 7. Validação

Partida de carreira, partida rápida e multiplayer usando o mesmo pipeline; testes em desktop, celular e tablet nos três horários, incluindo replay de gol e rede balançando; partida longa para medir estabilidade; conferência de erros de execução, tipos e build.

## Detalhes técnicos

Base preservada: React Three Fiber, drei, Three.js e @react-three/postprocessing. Texturas geradas por código de forma determinística (mesmo clube, mesmo resultado) em canvas, com mipmaps e espaço de cor correto. Materiais e geometrias criados uma única vez e reaproveitados via memo/instanciamento. O trabalho é grande e será entregue em etapas nesta ordem: reorganização dos arquivos, campo, estádio/torcida, pós-processamento, jogadores, ajuste fino de desempenho.
