# Anatomia dos jogadores + 59 animações complexas

## Objetivo

Corrigir a anatomia dos bonecos (hoje: cápsulas soltas sem articulações, braços que giram pelo centro, pernas sem joelho, pés ausentes) e substituir a animação única de "correr/comemorar" por um sistema com 59 animações complexas usadas durante a partida.

## Parte 1 — Anatomia correta

Reconstruir o jogador como esqueleto hierárquico, com pivôs nas articulações (hoje tudo gira pelo centro da peça, causando braços "quebrados"):

```text
raiz (chão)
└ quadril (y≈0.95)
  ├ tronco → peito → pescoço → cabeça (+ cabelo, orelhas, rosto simples)
  │  ├ ombro E → braço → cotovelo → antebraço → mão (+ luva GK)
  │  └ ombro D → braço → cotovelo → antebraço → mão
  ├ coxa E → joelho → panturrilha → tornozelo → pé/chuteira
  └ coxa D → joelho → panturrilha → tornozelo → pé/chuteira
```

Correções de proporção: altura ~1,80 (8 cabeças), ombros mais largos que o quadril, pernas ≈ 48% da altura, braços com cotovelo real, pés visíveis, meiões e caneleiras alinhados com a panturrilha, cabeça menor e melhor encaixada no pescoço. Variação física por jogador (altura, porte, tom de pele, cabelo) continua determinística pelo id.

## Parte 2 — 59 animações

Um módulo de animação procedural (poses + curvas por junta, com transições suaves) com 59 clipes nomeados, agrupados:

- Locomoção (12): parado, respirando, ajuste de peso, caminhada, trote, corrida, sprint, desaceleração, giro, passo lateral, corrida de costas, cansado.
- Com a bola (10): condução leve, condução em velocidade, drible curto, corte, pedalada, elástico, passe curto, passe longo, cruzamento, domínio.
- Finalização (8): chute rasteiro, chute de força, chapa, cavadinha, voleio, bicicleta, cabeceio, chute de primeira.
- Defesa (8): marcação, carrinho, desarme em pé, bloqueio, corte de cabeça, disputa de ombro, interceptação, recuo.
- Goleiro (8): posição base, deslocamento lateral, defesa baixa, defesa alta, voo E, voo D, encaixe, reposição/tiro de meta.
- Bola parada e jogo (7): tiro de meta, lateral, escanteio, falta, pênalti, apito/parado, reinício.
- Reações (6): comemoração de braços abertos, corrida de comemoração, deslize de joelhos, abraço/grupo, decepção, reclamação com o árbitro.

Total: 59.

Seleção do clipe: máquina de estados por jogador que combina velocidade, distância da bola, posse, papel (GK/linha), fase do jogo e eventos do simulador. Transições com blend (~0,15 s) para não haver "salto" de pose.

## Parte 3 — Ligações com o simulador

Para que chute, passe, defesa, carrinho e comemoração apareçam no momento certo, o simulador passa a marcar um gatilho curto no jogador (ex.: `action: "shot" | "pass" | "save" | "tackle" | "celebrate"` com duração). É um campo novo em `SimPlayer` e marcações nos pontos onde esses eventos já ocorrem — sem mudar as regras nem o resultado das partidas.

## Detalhes técnicos

- Arquivos: novo `src/game/animation.ts` (catálogo dos 59 clipes + máquina de estados), reescrita de `PlayerMesh` em `src/components/game/Stadium3D.tsx` (hierarquia de juntas com refs), pequenos gatilhos em `src/game/sim.ts`.
- Continua 100% procedural (sem modelos externos), com refs e `useFrame` — nada de estado React por quadro.
- Custo controlado: no modo "baixa"/"média" as juntas de dedos/detalhes finos são simplificadas e o passo de animação roda em taxa reduzida para jogadores longe da câmera.

## Verificação

`tsgo --noEmit`, build, e captura de tela via Playwright em cena de teste temporária (corrida, chute, defesa, comemoração) antes de finalizar.
