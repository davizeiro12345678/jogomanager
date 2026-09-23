# Salto de qualidade nos jogadores: anatomia, física e movimento

Objetivo: deixar os atletas visivelmente mais reais e mais bem animados, sem perder velocidade. A regra continua a mesma: primeiro roda bem, depois fica bonito. Nada de trocar de motor gráfico nem de adicionar bibliotecas novas.

## O que muda para quem joga

1. **Corpos mais humanos** — proporções por posição (goleiros mais altos, zagueiros mais fortes, pontas mais leves), ombros e peito com forma anatômica em vez de cilindros, pescoço, mãos e pés mais corretos, e variação real de biotipo entre os 22 em campo.
2. **Rosto e cabelo melhores de perto** — cabeça com formato mais realista, orelhas, sobrancelhas, olhos com íris, e cabelo com volume por estilo. Só no nível de detalhe mais próximo, para não pesar.
3. **Movimento com peso** — o corpo passa a inclinar na aceleração, na frenagem e na curva; o tronco gira contra os braços na corrida; a respiração e o cansaço aparecem na postura ao longo da partida.
4. **Pé que não escorrega** — o pé de apoio fica travado no gramado durante o passo, e a cadência da passada acompanha a velocidade real, eliminando o efeito de patinação.
5. **Contato com a bola mais crível** — perna que arma, toca e acompanha o chute no tempo certo; recepção, domínio e drible com o pé correto; goleiro com mergulho e apoio de mão coerentes.
6. **Transições limpas** — a troca entre correr, frear, girar, chutar e comemorar deixa de ter "pulo" de pose.

## Desempenho (condição de entrega)

- Nenhuma das melhorias acima entra no nível distante: de longe os atletas continuam no modo instanciado barato.
- Detalhes de rosto, cabelo e deformação anatômica só existem no nível próximo, com limite de quantos jogadores podem estar nesse nível ao mesmo tempo.
- Geometrias e materiais continuam compartilhados/cacheados por combinação, sem criar material por jogador.
- Medição antes e depois com o painel de FPS já existente (média, p95 e 1% low, draw calls, triângulos). Se um item custar mais do que entrega, ele é reduzido ou cortado.
- FPS em placa de vídeo real segue marcado como "não medido" aqui no ambiente; a validação final precisa ser feita no seu aparelho.

## Detalhes técnicos

**Anatomia (`src/game/player-model.ts`)**
- `Proportions` ganha modificadores por posição e biotipo, além dos atuais `height`/`girth`: largura de ombro, profundidade de peito, comprimento de perna e tamanho de pé deixam de ser um único multiplicador global.
- Novos campos derivados para a cabeça (largura, profundidade, queixo) e para o pescoço, consumidos só no LOD 0.
- `segmentsFor` passa a distinguir tronco/cabeça de membros, para gastar polígono onde aparece.

**Malha e materiais (`src/components/game/players/PlayerRig.tsx`, `player-materials.ts`)**
- Torso, ombros e coxas passam a usar geometrias com perfil (cônico/elipsoide) em vez de cápsulas uniformes, reaproveitadas via cache por chave de proporção arredondada.
- Cabeça em LOD 0 com orelhas, sobrancelhas e íris; cabelo por estilo com volume; tudo removido em LOD 1 e 2.
- Conclusão do LOD por grupos (`nearGroups`/`midGroups`) e hoisting dos subcomponentes de braço/perna, que hoje estão remontando a cada render.

**Movimento e IK (`src/game/ik-solver.ts`, `animation*.ts`, `visual-frame-cache.ts`)**
- Foot locking com trava do pé de apoio em coordenadas de mundo durante a fase de contato, liberado com blend curto.
- Motion warping: a passada é reescalada pela velocidade real (já existe `GAIT_SPEED`, passa a valer também para direção lateral e curva).
- Inclinação do corpo derivada de aceleração e de mudança de direção, com limite para não caricaturar.
- Contra-rotação tronco/quadril e balanço de braço proporcional à cadência.
- Marcadores de fase (armar, contato, acompanhamento) usados para alinhar o pé à bola no frame do contato.
- Fadiga do jogador (estado já existente na simulação) influencia amplitude de passada e postura.

**Física do corpo (sem nova dependência)**
- Mantida a simulação determinística própria no Worker. O que muda é só a camada visual: amortecimento de cabelo/braços e reação de impacto em disputas e quedas resolvidos por molas simples no rig, sem corpo rígido.

**Verificação**
- `bunx tsgo --noEmit`, `bunx vitest run` e `bun run build` limpos.
- Testes de animação estendidos: bloqueio do pé de apoio, alinhamento na fase de contato e ausência de salto de pose nas transições.

## Ordem de entrega

1. Anatomia e proporções + conclusão do LOD (base, ganho de desempenho junto).
2. Movimento: foot locking, motion warping, inclinação e contra-rotação.
3. Contato com a bola por fase e ajustes de goleiro.
4. Rosto, cabelo e acabamento de material em LOD 0.
5. Medição final de FPS e corte do que não se pagar.
