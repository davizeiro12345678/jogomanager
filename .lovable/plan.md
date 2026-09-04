# Mega atualização: jogadores, estádio, engine e pular partida

## 1. Novo script dedicado aos jogadores (~1360 linhas)

Criar `src/game/player-model.ts` + `src/components/game/players/PlayerRig.tsx`: um sistema próprio, altamente desenvolvido, só para os jogadores, hoje espalhado dentro do `Stadium3D.tsx`.

Conteúdo:
- Gerador determinístico de aparência por id: altura, porte, tom de pele, tipo de cabelo (barba, cavanhaque, tranças, dreads, moicano, careca, rabo, faixa), luvas, mangas, braçadeira, meiões, chuteiras coloridas.
- Esqueleto real com pivôs em quadril, coluna, peito, pescoço, ombro, cotovelo, punho, joelho, tornozelo — nada gira mais pelo centro da peça.
- Camada de materiais por qualidade (pele com sheen/clearcoat só no Alto; simplificado no Médio/Baixo).
- Três níveis de LOD (perto: rosto e dedos; médio: corpo completo; longe: silhueta barata) com troca por distância de câmera.
- Camisa com número nas costas e no calção, nome opcional, escudo no peito.
- Sombra de contato individual e leve deformação de passada.

## 2. Animação melhor

Aproveitar o catálogo já existente em `src/game/animation.ts` e ligá-lo ao novo esqueleto: blend suave entre clipes, velocidade da passada proporcional à velocidade real, inclinação do tronco em curva, cabeça olhando para a bola, braços do goleiro sempre prontos.

## 3. Estádio

- Arquibancada em anéis com inclinação e escadas, cobertura com treliça e sombra no gramado.
- Torcida instanciada mais densa, mosaico nas cores do mandante, onda e reação a gol.
- Gramado com listras de corte de maior resolução, desgaste nas áreas e brilho úmido.
- Redes mais finas com balanço no gol, traves metálicas, bandeirinhas de escanteio, placas de publicidade que trocam de anúncio, banco de reservas ocupado.
- Refletores com halo à noite e três horários (dia, entardecer, noite).

## 4. Correções e melhorias da engine

Ajustes em `src/game/sim.ts` que hoje deixam a partida artificial:
- Passo fixo interno (acumulador) em vez de depender do dt do navegador — resultado igual em qualquer máquina/velocidade.
- Bola com física melhor: altura real com gravidade, quique, atrito separado no chão e no ar, e efeito na curva de cruzamentos.
- Fora de campo correto: lateral, escanteio e tiro de meta de acordo com quem tocou por último, com reposição no ponto certo.
- Marcação individual, linha de impedimento simples e recomposição defensiva.
- Cansaço afetando velocidade e precisão ao longo dos 90 minutos; substituições automáticas.
- Cartões amarelo/vermelho e acréscimos.
- Chute e defesa com dependência real de ângulo e posição do goleiro.

## 5. Pular partidas

- Botão "Pular partida" no HUD que resolve o restante instantaneamente e vai direto ao resumo (hoje existe um "skip" que só congela a tela).
- Opção "Simular sem 3D" antes do início, para quem quer o resultado rápido, com resumo de gols, cartões e estatísticas.
- Preferência lembrada no navegador.

## Detalhes técnicos

- Novos módulos: `src/game/player-model.ts`, `src/components/game/players/PlayerRig.tsx`, `src/components/game/stadium/*`; `Stadium3D.tsx` vira o compositor.
- Stack mantida: R3F v9 + drei v10 + three, postprocessing já instalado; nada de assets externos.
- Sim continua determinístico por seed; a mudança para passo fixo altera resultados de partidas ainda não jogadas, não os salvos.
- Verificação: `tsgo --noEmit`, build e screenshots via Playwright em Baixo/Médio/Alto.
