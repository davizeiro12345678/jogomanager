# Avaliação local das orientações para atletas e torcida

Esta avaliação não chama a OpenAI. O plano usado é um conjunto fixo de
orientações para posições, para verificar o caminho entre plano e simulador;
não é uma resposta real do GPT-6.1 Terra.

O script `evaluate.mjs` roda dez sementes de Flamengo × Palmeiras em três
condições: a revisão base, a revisão candidata sem orientações e a candidata
com o plano fixo. Os parâmetros, equipes e sementes são iguais. As estatísticas
completas de cada partida estão em `results.json`.

- Sem orientações, os estados finais e os números de passos e estatísticas
  foram idênticos entre base e candidata nas dez sementes.
- Com o plano fixo, houve 246 finalizações, 4.177 passes e 31 gols no agregado;
  a base teve 228 finalizações, 4.200 passes e 21 gols. A amostra pequena mede
  apenas esse confronto e não prova maior inteligência, qualidade ou equilíbrio.
- Um teste controlado usa o mesmo lance e sorteio para verificar que a
  orientação de um atacante altera sua decisão de chutar. Outros testes
  rejeitam instruções malformadas e verificam o mapeamento da torcida para o
  sistema de reação existente.

A integração é limitada à partida rápida local autenticada e começa desativada.
Ainda faltam chamada real à API, avaliação com respostas reais, teste visual de
torcida e comparação em aparelhos físicos. O multiplayer online continua sem
o transporte autoritativo descrito no relatório de segurança anterior.
