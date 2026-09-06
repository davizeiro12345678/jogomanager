# Salto de realismo: estádio, campo, jogadores, torcida e cinema

Continuação direta do trabalho já feito (arquibancadas de concreto, cadeiras em mosaico, LED contínuo, torcida com ombros/cabelo). Agora o foco é fechar o pacote visual e limpar os defeitos que aparecem em partida.

## 1. Campo muito mais detalhado

- Camada de desgaste real: áreas mais gastas na grande área, no círculo central e nas faixas laterais, com manchas de lama e terra que aparecem só onde o jogo pisa mais.
- Corte do gramado com micro-fibras e variação por faixa, em vez de listras uniformes.
- Brilho úmido rasante (a grama reflete mais quando a luz vem de lado), com intensidade menor no modo dia.
- Tufos de grama em 3D só perto da câmera, com vento leve, e nada disso longe (custo zero à distância).
- Marcação de cal com borda imperfeita e leve apagamento em pontos de tráfego.

## 2. Estádio

- Cobertura com estrutura metálica visível, calhas e sombra própria sobre os primeiros anéis.
- Setores separados por corredores, com grades e escadas rentes à arquibancada (sem peças invadindo o campo).
- Refletores com halo e reflexo no gramado à noite; placas e telão com brilho coerente.
- Sujeira e desgaste procedural nas paredes de concreto, faixas de torcida e bandeirões maiores atrás dos gols.

## 3. Jogadores

- Corpo mais anatômico: ombros, peito, panturrilha e pescoço definidos, em vez de cápsulas.
- Uniforme com gola, mangas, número nas costas e meião/chuteira separados.
- Cabelo em volumes variados e tons de pele mais amplos.
- Sombra de contato colada ao pé e suor/brilho sutil no nível de detalhe mais próximo.
- Três níveis de detalhe revisados para manter a taxa de quadros no celular.

## 4. Torcida

- Bandeirões com ondulação, faixas horizontais e mosaicos por setor mais legíveis.
- Ola mais orgânica (propagação circular, não linear) e comemoração de gol com pulos escalonados.
- Alguns torcedores sentados, outros de pé, com densidade menor nos setores neutros.

## 5. Pós-processamento de transmissão

- Presets separados: partida, replay, momento dramático e celular.
- Oclusão de ambiente, foco seletivo (fundo desfocado), correção de cor de transmissão, granulado leve, vinheta e reflexo de lente nos refletores.
- Queda automática de efeitos quando a taxa de quadros cai, sem piscar.

## 6. Cutscenes

- Camadas com paralaxe e movimento lento de câmera nas cenas.
- Iluminação por hora do dia e transição suave entre falas.
- Retrato do treinador reagindo à cena (expressão e postura).

## 7. Bugs e falhas

- Varredura de partida longa (90 minutos em velocidade alta) para achar travas de jogada, bola presa e erros no console.
- Correção do texto duplicado/sobreposto nas placas de LED.
- Revisão de estados presos no fluxo de partida (pausa, replay, pular, fim de jogo) e de avisos do console.
- Verificação de temporada completa em automático sem erro.

## Notas técnicas

- Modularização de `Stadium3D.tsx` em `src/components/game/stadium/` (`Pitch`, `Goals`, `Structure`, `Crowd`, `Lighting`, `Props`), mantendo o pipeline atual e o memo do componente.
- Texturas geradas em canvas com cache global por sessão e semente fixa (determinístico entre recargas).
- Geometrias e materiais compartilhados entre instâncias; torcida e tufos de grama via instanciação.
- `PostFX` recebe qualidade + momento; qualidade baixa continua sem efeitos.
- Validação: verificação de tipos limpa, captura em partida real e console sem erros antes de entregar.
