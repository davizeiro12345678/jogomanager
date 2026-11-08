# Diagnóstico dos checks do PR #125 — SHA `b8df3cb`

**Observado em:** 2026-11-07, aproximadamente 21:24 BRT (2026-11-08 00:24 UTC)
**SHA medido:** `b8df3cb1aa905ddc93e39f694cf53f15ea2fcc56`. O commit `b8df3cb` acrescentou documentação sobre `b72a2fd`; não alterou o código medido pelo build.
**PR:** [#125](https://github.com/davizeiro12345678/jogomanager/pull/125), ainda aberto em draft.

## Conclusão corrigida

A conclusão do workflow **Quality gates** não está falsamente verde nem é um falso positivo: o run [42428747855](https://github.com/davizeiro12345678/jogomanager/actions/runs/42428747855) terminou com `failure`. O job [Lighthouse mobile multi-page audit](https://github.com/davizeiro12345678/jogomanager/actions/runs/42428747855/job/128572682726) falhou e o [Critical performance release gate](https://github.com/davizeiro12345678/jogomanager/actions/runs/42428747855/job/128574251711) corretamente propagou `lighthouse-mobile: failure`. O log do agregador mostra que os outros sete jobs necessários tiveram resultado `success`.

O erro da minha atualização anterior foi tratar a saída parcial do observador `gh pr checks --watch` como conclusão de todos os fluxos. **Não é**: no momento da verificação, o processo local ainda estava em modo de observação e o check separado `evidence` continuava `in_progress`. A API confirma dois estados distintos: Quality gates concluído com falha; Match 3D visual evidence ainda em execução. Não se deve resumir isso como “todos os checks terminaram”.

O fluxo visual é definido em [`.github/workflows/match3d-visual-qa.yml`](https://github.com/davizeiro12345678/jogomanager/blob/b8df3cb1aa905ddc93e39f694cf53f15ea2fcc56/.github/workflows/match3d-visual-qa.yml). Na última leitura, o run [42428747827](https://github.com/davizeiro12345678/jogomanager/actions/runs/42428747827), job `evidence` (`128572764254`), estava há cerca de 10 minutos no passo `Build and capture baseline with the candidate evidence runner`; o workflow prevê duas capturas seriais, cenas/quadros e encodes, com `timeout-minutes: 60`. Isso é uma execução longa ainda dentro do timeout, não prova de travamento. O GitHub ainda não disponibilizava o log de um job ativo e não havia artifact desse run. Não cancelei nem lancei uma duplicata.

## Lighthouse mobile: resultados por rota

Fonte: os 15 relatórios JSON do artifact `lighthouse-results` associado ao run [42428747855](https://github.com/davizeiro12345678/jogomanager/actions/runs/42428747855). Configuração versionada em [`.lighthouserc.mobile.cjs`](https://github.com/davizeiro12345678/jogomanager/blob/b8df3cb1aa905ddc93e39f694cf53f15ea2fcc56/.lighthouserc.mobile.cjs): cinco URLs, três execuções por URL, mobile simulado a 390×844/DPR 2,75, agregação pessimista. Os budgets relevantes são score de performance mínimo 0,97, TBT máximo 200 ms, LCP máximo 2.500 ms e CLS máximo 0,1.

| Rota                  | Score de performance nas 3 execuções |          TBT (ms) |                  LCP (ms) |              CLS | Leitura                                                                                                      |
| --------------------- | -----------------------------------: | ----------------: | ------------------------: | ---------------: | ------------------------------------------------------------------------------------------------------------ |
| `/`                   |                           87, 98, 98 | 459,1; 22,5; 22,5 | 2.062,4; 1.997,3; 2.003,3 |          0; 0; 0 | **Falha real:** primeira execução abaixo de 0,97 e TBT acima de 200 ms. As outras duas passam estes budgets. |
| `/guias`              |                        100, 100, 100 |        41; 40; 51 |   1.399,3; 934,5; 1.394,5 |          0; 0; 0 | Dentro dos budgets observados.                                                                               |
| `/guia-de-scouting`   |                        100, 100, 100 |        42; 46; 44 | 1.400,2; 1.405,8; 1.397,3 |          0; 0; 0 | Dentro dos budgets observados.                                                                               |
| `/melhores-formacoes` |                        100, 100, 100 |        39; 45; 44 | 1.398,7; 1.401,5; 1.535,9 |          0; 0; 0 | Dentro dos budgets observados.                                                                               |
| `/partida-rapida`     |                           99, 99, 99 |     114; 107; 110 | 1.520,2; 1.404,3; 1.397,7 | 0,004964 em cada | Dentro dos budgets observados.                                                                               |

A reprovação móvel concentra-se no outlier da home: 1 de 3 execuções marca performance 87/100 e TBT 459,1 ms, acima do limite de 200 ms. LCP (2.062,4 ms no pior run) e CLS (0) permanecem dentro dos limites. O LCP desse run é a imagem `.home-hero-image`; ela não explica por si só a reprovação de TBT.

## Pista de profiling, não causalidade provada

No JSON do run ruim, o audit `long-tasks` lista uma tarefa atribuída à página `/` de 513 ms, iniciada aproximadamente em 1.401 ms, uma tarefa atribuída ao chunk `hydrate-app-ChrRn7s9.js` de 432 ms, iniciada aproximadamente em 4.166 ms, além de tarefas classificadas como `Unattributable` de 307 ms e 211 ms. O audit `bootup-time` atribui ao mesmo chunk `hydrate-app` 596 ms de tempo total, incluindo 546,1 ms de scripting; `browser-react` aparece com 222,3 ms total e 210,3 ms de scripting. Esses valores por URL/tarefa podem se sobrepor e **não devem ser somados** como se fossem fases independentes.

Nas outras duas execuções da home, TBT foi 22,5 ms; cada uma ainda reporta tarefa de 95 ms associada ao `hydrate-app`, muito menor que os 432 ms do outlier. Isso aponta para uma investigação focada na inicialização/hidratação da home e na variância do runner. Sem trace/call stack do run ruim não é possível atribuir o bloqueio a um componente específico nem concluir que `hydrate-app` sozinho é a causa final.

## Diagnóstico do comportamento dos checks

- A agregação de release em [`quality.yml`](https://github.com/davizeiro12345678/jogomanager/blob/b8df3cb1aa905ddc93e39f694cf53f15ea2fcc56/.github/workflows/quality.yml#L101-L128) usa `if: always()` e exige que todos os jobs críticos listados sejam `success`. O log registra apenas `lighthouse-mobile: failure`; portanto, a conclusão global `failure` é consistente com o contrato fail-closed.
- `evidence` pertence a outro workflow e não está no `needs` do agregador crítico. Seu estado deve ser consultado separadamente; falha/pendência de uma execução não transforma a outra em sucesso nem em conclusão final de todos os checks.
- Procedimento de status para um SHA: consultar `GET /repos/davizeiro12345678/jogomanager/commits/{sha}/check-runs` e `GET /repos/davizeiro12345678/jogomanager/actions/runs?head_sha={sha}`; aguardar `status=completed` para cada workflow que a aceitação exige e ler cada `conclusion`. Usar somente o exit code do `gh pr checks --watch` não responde se um workflow visual separado terminou.
- `gh run view --log` não disponibilizou logs do job `evidence` enquanto ele ainda estava `in_progress`; não inferir conclusão a partir da ausência de log.

## Próxima ação do plano

1. Manter o release bloqueado. Não elevar o score floor, remover TBT, mudar a agregação pessimista nem transformar ausência/pendência de evidência em aprovação.
2. Reproduzir a home sob a mesma build, browser, viewport, throttling e três repetições. Capturar trace de Performance/CDP para o outlier e pelo menos um run bom; atribuir a tarefa de 513 ms, o scripting do `hydrate-app` e os períodos `Unattributable` a funções/tarefas concretas antes de mexer no código.
3. Fazer uma alteração de performance por vez, manter o comportamento/metadata da página e repetir o mesmo teste. Só considerar a correção quando os três runs atenderem aos budgets pessimistas e os testes/build/bundle permanecerem verdes; complementar com dados de campo (INP/RUM) quando disponíveis, sem equiparar TBT laboratorial a INP.
4. Registrar a conclusão final de `evidence` separadamente. Ela ainda estava ativa na última observação; este documento não certifica a comparação visual desse run.
5. Não fazer merge nem promoção. O PR continua em draft até uma correção medida, a nova CI do SHA candidato e todos os checks e artifacts exigidos terminarem no estado aprovado.

## Adendo posterior — 2026-11-08

O registro acima descreve corretamente a política vigente no SHA histórico e não foi reescrito. Na atualização posterior do PR #125, o responsável pelo projeto pediu explicitamente que os requisitos fossem afrouxados porque estavam difíceis de cumprir. O run `42451063358` mediu score/TBT mínimos/máximos de 0,90/338,9 ms na home e 0,95/243 ms em partida rápida; as outras três rotas passaram os limites anteriores. Como resultado, a política foi atualizada para score mínimo 0,90 e TBT máximo 400 ms, mantendo as cinco rotas, três medições, agregação pessimista, severidade de erro, LCP/CLS/acessibilidade e o gate crítico fail-closed. A alteração ajusta a aceitação por instrução explícita do dono; não deve ser descrita como correção da latência ou como prova de melhoria do runtime.
