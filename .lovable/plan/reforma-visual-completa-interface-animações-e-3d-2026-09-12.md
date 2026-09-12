# Reforma visual completa: interface, animações e 3D

Objetivo: deixar o jogo visualmente muito mais forte em todas as telas, com animações vivas, e um campo 3D bem mais bonito — mantendo no mínimo 45 quadros por segundo no modo Alto.

## 1. Escolha da nova direção visual

Antes de mexer em qualquer tela, capturo a aparência atual do painel e da página inicial e gero **três propostas visuais completas** para você escolher. Só depois começo a construir.

Cada proposta traz cores, tipografia, densidade e estilo de cartões diferentes. Você escolhe uma e ela vira a identidade de todo o jogo.

## 2. Base do design

Com a direção escolhida:

- Novas cores, tipografia e sombras aplicadas em um único lugar, para valer em todas as telas de uma vez.
- Tipografia esportiva de verdade: números grandes de placar, títulos condensados, texto de leitura confortável.
- Cartões, tabelas, abas, botões e campos revisados com o mesmo padrão; alvos de toque de 44px mantidos.
- Cores do clube continuam aparecendo como destaque (escudo, faixa, brilho), sem brigar com a identidade geral.

## 3. Telas do jogo

- **Painel**: um "centro de comando" — próximo jogo em destaque, forma recente, moral, finanças, notícias e atalhos, com hierarquia clara em vez de blocos iguais.
- **Elenco**: retratos maiores, barras de atributo, indicadores de forma/lesão/contrato, ordenação e filtros, e comparação lado a lado.
- **Táticas**: campo com jogadores arrastáveis, linhas de formação, mapa de calor da postura escolhida e leitura de risco/equilíbrio.
- **Tabela e copas**: zonas de acesso/rebaixamento mais legíveis, minigráfico de forma, destaque do seu clube, chaveamento de mata-mata desenhado.
- **Treino, transferências, finanças e conquistas**: mesma linguagem, com gráficos no lugar de listas cruas.

## 4. Página inicial e loja

- Capa com o campo 3D vivo ao fundo, título forte e chamada direta para jogar.
- Seções de recursos com prévias reais do jogo em vez de texto solto.
- Loja com cartões de pacote mais claros, valor em destaque, estado de compra e confirmação animada.

## 5. Animações e transições

- Entrada suave de páginas e listas em cascata.
- Placar, dinheiro e atributos com contagem animada ao mudar.
- Gol, cartão, substituição e fim de jogo com celebração na tela.
- Retorno ao toque em botões, abas e cartões; carregamento com esqueleto no lugar de tela vazia.
- Tudo respeitando "reduzir movimento" para quem prefere menos animação.

## 6. Campo 3D muito melhor

- Gramado com listras reais, desgaste, relevo e reflexo molhado na chuva.
- Estádio com arquibancada em camadas, torcida por setores, bandeiras, placar e refletores.
- Iluminação por horário (dia, tarde, noturno) com céu e sombras coerentes.
- Jogadores com uniforme, número, sombra de contato e melhor leitura à distância.
- Câmera cinematográfica em gols e replays.
- Acabamento de imagem: brilho controlado, profundidade e cor de cinema.

## 7. Desempenho: mínimo de 45 FPS no modo Alto

Junto com o visual, otimização pesada:

- Agrupamento de objetos repetidos (torcida, grama, arquibancada) em poucos desenhos.
- Níveis de detalhe: jogador longe da câmera usa versão simples.
- Texturas geradas uma vez e reaproveitadas; reuso de materiais.
- Sombras e efeitos com custo controlado por nível de qualidade.
- Medidor interno de quadros que reduz sozinho os efeitos se cair abaixo de 45, e volta a subir quando sobra folga.
- Painel de desempenho na tela de Ajustes visuais mostrando quadros por segundo e qualidade em uso.

## 8. Verificação

Compilação e verificação de tipos limpas, todas as telas abertas sem erros, teste em celular e computador, e relatório de quadros por segundo em cada nível de qualidade.

## Detalhes técnicos

- Tokens em `src/styles.css` (Tailwind v4, `@theme inline`), consumidos por shadcn; nada de cor fixa em componente.
- Animações com Motion e utilitários CSS; `prefers-reduced-motion` respeitado globalmente.
- 3D em `src/components/game/Stadium3D.tsx` e `src/components/game/stadium/*`: `InstancedMesh` para torcida/grama, LOD para jogadores, materiais compartilhados, texturas por canvas com cache, `EffectComposer` com 1–2 passes.
- Laço de medição p95/p99 ligado ao `visual-settings` existente (`adaptive`, `resolutionScale`, `particles`, `shadows`), com degradação e recuperação automáticas.
- Entrega por etapas nesta ordem: direção escolhida → base → telas → 3D → animações → desempenho → verificação.
