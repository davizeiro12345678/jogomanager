# Correção após os resultados instrumentados

A meta de usar no máximo 79% do tempo anterior **não foi atingida em todos os cenários**. O job CodSpeed de `ccba0f9` mediu25benchmarks e enviou os dados, mas sucesso do job não significa aprovação de desempenho.

O relatório do bot compara com main e ainda apontou4regressões; também alertou para chamadas de sistema excluídas e tipos diferentes de runner. As durações abaixo são os HEADs publicados pelo bot antes/depois, arredondados, para orientar a investigação. Não são uma comparação walltime no mesmo runner:

| Cenário | 76f51b6 | ccba0f9 | Decisão |
|---|---:|---:|---|
|300ticks |205,7ms|212,3ms|Retirar o cálculo plano experimental|
|120passos |85,4ms|97,2ms|Retirar o cálculo plano experimental|
|Decoder|573,4ms|546,2ms|Ganho insuficiente para justificar o cache e a variabilidade local|
|Construtor|2,4ms|1,6ms|Manter redução do trabalho na construção|
|Cabeça próxima|522,1ms|181,8ms|Manter construção geométrica otimizada|
|Cabeça distante|56,9ms|14,9ms|Manter construção geométrica otimizada|

## Correção aplicada

- Voltam as chamadas nativas a Math.hypot e o integrador de atletas da base76f51b6. Nenhuma alteração das regras, passos139Hz ou valores canônicos.
- Removidos o helper experimental e seus testes exclusivos; nenhum cenário original de benchmark ou teste obrigatório foi removido.
- Decoder restaurado à implementação da base76f51b6, eliminando o cache de512KiB e as mudanças de alocação que não tiveram ganho suficiente.
- Permanecem a otimização do encoder, táticas/snapshots, geração TS/Rust/WASM, anatomia, poses/contato, escalação, RNG e temporada.

## Verificação da correção

22testes direcionados passaram. Campanha adicional:30sementes,90000ticks pareados,930checkpoints completos idênticos à base. Codificação e decodificação de23040quadros continuam exatamente iguais. As evidências locais estão nos arquivos `correction-*`.

A suíte completa e o estresse de200partidas passaram no commit anterior; a CI executará novamente para a correção. O novo CodSpeed deve ser consultado antes de declarar qualquer ganho dessa alteração. A meta global continua parcial, os limites obrigatórios permanecem, e o PR continua em rascunho, sem merge ou deploy de produção.
