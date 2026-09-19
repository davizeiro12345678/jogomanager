# Salto de qualidade: câmeras, cutscenes, narração, IA, jogadores, árbitro e torcida

Entrega única, focada em coisas que se veem e se ouvem na tela. Nada de auditoria, nada de item marcado como pronto sem estar pronto.

## 1. Câmeras da partida (corrigir travamento e repetição)
- Trocar o seguimento atual por uma câmera com amortecimento por tempo real (independente do FPS), zona morta ao redor da bola e limite de velocidade, acabando com o tremor.
- Diretor de câmera com repertório: lateral ampla, drone atrás da jogada, rasante na linha de fundo, close de duelo, torre do estádio e câmera de rede no gol. Escolha por contexto (posse, contra-ataque, bola alta, falta, gol) com tempo mínimo em cada plano e histórico que impede repetir o mesmo enquadramento seguido.
- Replay de gol com três cortes encadeados em vez de uma órbita só, mais uma câmera baixa de comemoração.

## 2. Cutscenes muito mais complexas
- Cada cena passa a ter linha do tempo própria: movimento de câmera, foco, entrada e saída de camadas, luz que muda ao longo do plano.
- Novas camadas: silhuetas em primeiro plano, névoa volumétrica, feixes de refletor, faíscas de pirotecnia, chuva e reflexos no piso, bandeirões e fumaça da torcida.
- Cenas ganham figuras animadas (jogadores andando no túnel, árbitro conferindo, massagista, fotógrafos com flash) em vez de silhuetas paradas.
- Continuidade com o clube: cores, escudo, nome e narração de abertura combinando com o adversário e a importância do jogo.

## 3. Narração
- Triplicar o repertório por idioma (PT/EN/ES) com variação por emoção: rotina, tensão, euforia, decepção, ironia.
- Falas contextuais de verdade: nome do jogador, minuto, placar, sequência de passes, defesa difícil, pressão no fim, virada, goleada, jogo travado.
- Ritmo: prioridade por importância do evento, corte de fala antiga quando acontece gol, pausas naturais e ênfase diferente conforme o volume do momento.

## 4. Inteligência da simulação
- Marcação por zona com troca de responsabilidade, linha defensiva que sobe e desce junta e armadilha de impedimento.
- Ataque com movimento sem bola: corta para dentro, sobreposição do lateral, passe em profundidade e opção de recuo.
- Decisão de passe/chute ponderada por ângulo, pressão, distância, perna boa e confiança do jogador.
- Goleiro melhor: posicionamento pelo ângulo, saída do gol, defesa com rebote controlado e reposição.
- Comportamento muda com o placar e o tempo restante (segurar resultado, pressão final).

## 5. Esqueleto completo dos jogadores
- Hierarquia real de ossos: quadril, três segmentos de coluna, peito, clavículas, pescoço, cabeça, ombro/braço/antebraço/mão com dedos agrupados, coxa/perna/tornozelo/pé com ponta do pé.
- Cabeça mais detalhada: crânio, mandíbula, orelhas, nariz, sobrancelhas, olhos com piscar, e cabelo em volumes.
- Pescoço e tronco com volume anatômico e torção real entre quadril e ombros.
- Animações novas: corrida em três intensidades, arrancada, frenagem, giro, drible, condução, passe, chute, cabeceio, carrinho, queda e levantar, comemoração, gesto de reclamação.
- Transições suaves entre animações, apoio dos pés no chão e peso alternado ao parar.

## 6. Árbitro e bandeirinhas
- Modelo próprio com uniforme, apito, cartões e relógio, corrida diagonal característica, gestos de falta, cartão amarelo/vermelho e apontar o centro.
- Bandeirinhas acompanhando a linha e levantando a bandeira no impedimento.

## 7. Torcida
- Corpos mais completos por nível de qualidade, roupas em cores do clube com variação, gente em pé e sentada.
- Reações coletivas: onda, pulos no gol, braços na cabeça em chance perdida, bandeirões e mosaico no setor principal.

## Detalhes técnicos
- Arquivos principais: `src/components/game/Stadium3D.tsx` (câmeras, árbitro, torcida), `src/components/game/players/PlayerRig.tsx` (esqueleto e animações), `src/components/game/Cutscene.tsx`, `src/game/narration-lines.ts` e `src/game/narrator.ts`, `src/game/sim.ts` (IA e goleiro).
- Tudo por nível de qualidade: ossos e detalhes extras só em alta; baixa mantém o custo atual para não perder quadros.
- Sem novas dependências pesadas; torcida e detalhes continuam instanciados.
- Validação ao final: testes da simulação e da narração, verificação de tipos, build e uma partida completa simulada para garantir que nada trava.

## Limites honestos
- Não dá para garantir número exato de quadros por segundo em qualquer aparelho aqui; a medição real precisa de hardware físico.
- Elencos reais dos clubes sem cobertura continuam bloqueados por licença de dados.
