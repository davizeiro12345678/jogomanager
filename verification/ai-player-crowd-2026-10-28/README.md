# Avaliação local das orientações para atletas e torcida

> A seleção da rota Match 3D em comparações de bundle anteriores pode ter
> confundido módulos com nomes semelhantes. Os números dessa rota devem ser
> reavaliados com o seletor corrigido antes de fundamentar uma publicação.

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
- O comparativo ABBA de construção, com Node 24.22.0, 62 amostras por revisão
  e 21 checkpoints idênticos, teve resultados divergentes. Na primeira rodada,
  a candidata ficou 21,9% mais lenta e o limite inferior do intervalo de 99%
  apontou regressão acima de 10%, reprovando o gate. Na repetição, a candidata
  ficou 4,4% mais rápida e o gate passou. As amostras brutas das duas rodadas
  estão em `performance/`; a divergência impede concluir que o desempenho foi
  melhorado ou que a primeira regressão esteja resolvida. A primeira medição
  coincidiu parcialmente com uma operação de busca no Git.
- O comparativo de bundles da proposta completa contra `main` falhou: total
  +3.273 bytes gzip e +2.940 bytes Brotli. Também houve aumentos nas rotas
  verificadas de carreira, Match 3D e worker. Os limites não foram alterados.

A integração é limitada à partida rápida local autenticada e começa desativada.
Ainda faltam chamada real à API, avaliação com respostas reais, teste visual de
torcida e comparação em aparelhos físicos. O multiplayer online continua sem
o transporte autoritativo descrito no relatório de segurança anterior.
