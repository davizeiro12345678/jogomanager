# Desempenho, cache, cutscenes, narração e salto gráfico 3D

## 1. Cache e entrega (economia apontada pelo PageSpeed: ~3.672 KiB)

- Definir `cache-control` longo e imutável para arquivos com hash no nome (`/assets/*`, `/_build/*`, fontes) e curto para HTML, no mesmo ponto onde hoje são aplicados os cabeçalhos de segurança (`src/start.ts`).
- Arquivos públicos sem hash (`favicon`, ícones, `manifest`, `og-cover`) recebem cache médio com revalidação.
- Service worker: subir a versão, pré-carregar o CSS/JS críticos da primeira tela e servir os hasheados direto do cache (hoje ele guarda, mas a primeira navegação continua indo à rede).
- Imagens: converter escudos, kits, capas e imagens de loja para AVIF/WebP responsivos com o mesmo mecanismo já usado na capa da home, com largura e altura fixas para não deslocar o layout.
- Reduzir o custo inicial de CSS/JS: dividir o pacote da partida 3D do pacote das páginas públicas, adiar o que não é usado na primeira tela e enxugar regras não utilizadas do `styles.css`.

## 2. Cutscenes muito mais complexas

- Linha do tempo por cena: cortes múltiplos de câmera, foco variável, entrada/saída de camadas e luz que evolui dentro do mesmo plano.
- Novas camadas: névoa volumétrica, feixes de refletor, pirotecnia, chuva com reflexo no piso, flashes de fotógrafo, bandeirões e fumaça.
- Figurantes animados nas cenas 3D (jogadores caminhando no túnel, roupeiro, árbitro conferindo, massagista) em vez de figuras paradas.
- Continuidade com o clube: cores, escudo, adversário e importância do jogo influenciam iluminação, torcida e falas.
- Cada cena ganha narração sincronizada, legenda e um caminho reduzido para quem prefere menos movimento.

## 3. Narração e voz

- Atualizar o modelo de voz para a versão mais recente disponível no provedor, com ajuste de estabilidade, estilo e velocidade por tipo de lance.
- Ampliar o repertório por idioma (PT/EN/ES) com variação emocional: rotina, tensão, euforia, decepção e ironia.
- Falas realmente contextuais: nome do jogador, minuto, placar, sequência de passes, defesa difícil, pressão final, virada e goleada.
- Ritmo: prioridade por importância, corte da fala antiga quando sai gol, pausas naturais e nada de vozes sobrepostas.

## 4. Inteligência da simulação

- Marcação por zona com troca de responsabilidade, linha defensiva conjunta e armadilha de impedimento.
- Ataque com movimento sem bola: corte para dentro, sobreposição do lateral, passe em profundidade e opção de recuo.
- Decisão de passe/chute ponderada por ângulo, pressão, distância, perna boa e confiança.
- Goleiro por ângulo, saída do gol, rebote controlado e reposição.
- Comportamento muda com placar e tempo restante (segurar resultado x pressão final).

## 5. Movimentos e animações

- Transições contínuas entre parado, caminhada, corrida, sprint, frenagem, giro, condução, drible, passe, chute, cabeceio, carrinho, queda e comemoração.
- Fim do escorregamento dos pés: aceleração, desaceleração, inclinação e rotação independentes da taxa de quadros, com apoio real no gramado.
- Peso alternado ao parar, torção entre quadril e ombros, braços acompanhando a corrida.

## 6. Física e gráficos 3D

- Bola: quique, atrito por tipo de gramado, efeito, trave/travessão e disputa corporal mais consistentes.
- Iluminação recalibrada (sol, ambiente, recorte, refletores), sombras mais definidas por distância e importância, contato simplificado nos jogadores distantes.
- Pós-processamento por nível de qualidade, sem perder quadros em aparelho fraco.
- WebGPU segue experimental com volta automática para o caminho estável; a correção pendente do erro de buffer entra neste ciclo, sem virar padrão.

## 7. Texturas novas (29)

Gramado (corte diamante, xadrez fino, listra larga, desgaste de área, desgaste de meio, lama, orvalho, grama seca), linhas (novas marcações e desgaste), bola (3 padrões), uniformes (listras, faixas, quadriculado, degradê, tecido furado, malha de goleiro), pele (3 tons com poros), cabelo (3 volumes), estádio (assentos gastos, concreto molhado, rede nova/velha, placa de LED, bandeira). Todas geradas no próprio projeto, em três níveis de detalhe, sem download externo.

## 8. Dependências

O projeto já usa Three, drei, postprocessing, Rapier, n8ao, three-mesh-bvh, three-stdlib, maath, camera-controls, meshline, simplex-noise, gsap, lenis e troika. Em vez de somar 12 pacotes só para bater o número — o que aumenta o peso baixado e piora justamente o desempenho reclamado —, entram apenas os que faltam e têm ganho real: compressão de geometria/textura, medição de quadros, detecção de recursos do aparelho e utilidades de animação. Qualquer pacote novo é carregado só na tela da partida.

## Detalhes técnicos

- Arquivos principais: `src/start.ts`, `public/sw.js`, `vite.config.ts`, `src/styles.css`, `src/components/game/Stadium3D.tsx`, `PlayerRig.tsx`, `Cutscene.tsx`, `CinematicStage3D.tsx`, `post/PostFX.tsx`, `stadium/textures/*`, `src/game/sim.ts`, `narrator.ts`, `narration-lines.ts`, `src/lib/tts.functions.ts`.
- Validação: testes da simulação e da narração, verificação de tipos, build limpo e uma partida completa no navegador.

## Limites honestos

- A medição real de quadros por segundo precisa de aparelho com placa de vídeo física; aqui o ambiente renderiza por software e o número não representa o jogador.
- A economia exata de KiB só pode ser confirmada rodando o PageSpeed de novo depois de publicar.
