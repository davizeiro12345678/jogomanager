# Trabalho inicial da seleção de partida rápida

O gate móvel do head `bc8982f32f53f5514cc8fdf6f3768df03729c2e0` falhou em uma das três execuções de `/partida-rapida`: performance 0,96 e TBT 212 ms, para limites existentes de 0,97 e 200 ms. As outras duas execuções passaram. A atribuição em `ci-mobile-quick-route-attribution.json` identifica uma tarefa de React de 280 ms, mas não fornece uma pilha que permita atribuir toda essa tarefa a uma função da aplicação. Os chunks da seleção e do React eram idênticos aos da campanha anterior; o endpoint de escudos retornava HTTP 500 com um corpo pequeno, sem um grande catálogo para interpretar.

## Alteração implementada

O gerador existente agora calcula o agrupamento e a ordenação dos países para os **26 idiomas publicados**. O algoritmo preserva Brasil em primeiro lugar, a comparação `Intl.Collator(lang)` entre os outros países e a ordem original das ligas dentro de cada país. Ordens iguais compartilham a mesma variante: o catálogo atual contém **300 ligas, 102 grupos de países e uma única variante de ordem**.

A seleção inicial usa referências estáveis desses grupos. Não constrói `Intl.Collator`, não agrupa e não ordena o diretório a cada renderização. Componentes React memoizados reutilizam as opções nativas de ligas e clubes quando o idioma detectado ou outro controle provoca nova renderização. O seletor de clubes continua recalculando suas opções quando muda o elenco ou o clube adversário, preservando a exclusão desse adversário.

A extração não acrescenta elementos de DOM e mantém os seletores nativos, os rótulos, os valores selecionados e todas as opções no SSR. Não foram adicionados timers, adiamentos artificiais, hooks condicionais ou novas cargas antecipadas. Catálogo completo, mundo e partida 3D continuam dependentes da interação já existente.

## Evidência desta alteração

- [quick-startup-options-tests.json](./quick-startup-options-tests.json): **43 testes aprovados**, zero falhas, em seis arquivos. Inclui paridade exata para todos os 26 idiomas, identidade de referências entre variantes iguais e ausência de collation em runtime.
- A regressão SSR compara o HTML completo das opções com o algoritmo anterior: **300 opções de liga e duas listas de 20 clubes**, na mesma ordem, com os mesmos valores selecionados e adversários desabilitados. Os três seletores são preservados.
- [quick-selection-browser-order.json](./quick-selection-browser-order.json): comparação pequena em navegador Chromium/Edge real, versão 157.0.4341.42. Os **26 idiomas** apresentam grupos, ligas e ordenação **idênticos** entre o gerador com Node 24.22.0 e `Intl.Collator` do navegador. Não houve necessidade de um fallback que alterasse a ordenação.
- TypeScript global e ESLint global passaram com saída 0, sem diagnósticos.
- [quick-startup-i18n-check.json](./quick-startup-i18n-check.json): gate de candidatos hardcoded aprovado; baseline 3.058, atual 3.050, nenhum candidato novo. O baseline não foi regenerado.

Os números de TBT acima descrevem a falha anterior. Esta verificação de ordem não mede FPS, Lighthouse nem ganho de CPU. O build seguinte precisa confirmar os limites existentes de bytes e uma nova campanha móvel precisa medir o resultado. Nenhum gate, fixture, renderer ou regra de simulação foi alterado.
