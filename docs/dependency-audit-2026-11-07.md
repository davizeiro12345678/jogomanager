# Auditoria de dependências — 2026-11-07

A auditoria foi executada no worktree `jogomanager-pr125`, com Node `v24.22.0` e npm `11.19.1`, usando o `package-lock.json` atual. O escopo ficou limitado a `package.json`, `package-lock.json` e este relatório. Não foram executados `npm ci`, instalação que alterasse `node_modules`, build geral, deploy ou chamadas de mutação externa.

## Resultado do npm audit

O comando focal foi:

```text
npm audit --package-lock-only --json
```

Ele terminou com código 1 porque existem achados, não por falha de leitura do lock. O resumo exato foi:

```text
critical: 0
high: 0
moderate: 0
low: 4
info: 0
total: 4
```

O relatório npm contou 602 dependências de produção, 257 de desenvolvimento e 162 opcionais na árvore auditada. Os quatro nós reportados são `@react-email/components`, `@react-email/render`, `html-to-text` e `deepmerge`; todos aparecem com `fixAvailable: false`. Os três primeiros são efeitos agregados da cadeia que termina no advisory de `deepmerge`, não três advisories independentes.

O achado raiz é `deepmerge@4.3.1`, afetado no intervalo `>=4.2.0 <=4.3.1` por prototype poisoning em `mergeObject()`. O advisory oficial classifica-o como low e informa explicitamente que não há versão corrigida publicada [3]. Portanto, não há override de versão estável e verificado que possa ser aplicado com segurança. Forçar um fork, um commit não publicado ou uma versão fora do contrato de `@react-email/render` ampliaria o risco e não é uma correção patch-safe.

A cadeia alcançável no grafo de produção é:

```text
@react-email/components@1.0.12
  -> @react-email/render@2.0.6 (instância aninhada)
    -> html-to-text@9.0.5
      -> deepmerge@4.3.1
```

O lock marca essa cadeia como produção (`dev: false`). Além disso, há consumidores no código em `src/lib/email-templates/`, `src/lib/email-templates/send-email.ts` e nas rotas de preview de email. Isso demonstra alcançabilidade pelo grafo e pelo código-fonte; a auditoria não tentou inferir que cada template seja invocado em toda execução do servidor. A dependência direta separada `@react-email/render@^2.1.0` resolve para `2.2.0` e sua instância de `html-to-text@10.0.1` não está no intervalo reportado pelo advisory. O problema permanece na instância aninhada exigida por `@react-email/components@1.0.12`.

O contexto de auditoria anterior mencionava achados low de produção e moderate de desenvolvimento. No lock exato atual, não há moderate, high ou critical; isso não significa auditoria limpa, porque o low de produção continua presente e sem correção upstream. A decisão correta é manter a visibilidade do achado, acompanhar uma versão corrigida de upstream e não mascará-lo com override arbitrário.

## Verificação de `follow-redirects`

`package.json` já contém o override estreito:

```json
"follow-redirects": "1.16.2"
```

O `package-lock.json` contém exatamente `node_modules/follow-redirects@1.16.2`, com o tarball e integridade correspondentes. `npm explain follow-redirects --json` confirmou que o pacote está marcado como overridden e é apenas de desenvolvimento, vindo de `@codspeed/tinybench-plugin -> @codspeed/core -> axios -> follow-redirects`.

O advisory oficial de `follow-redirects` afeta `1.16.0` até `1.16.1` e fixa a vulnerabilidade em `1.16.2` [1]. A página oficial do pacote também identifica `1.16.2` como a versão latest publicada [2]. Assim, o patch high solicitado já está presente no lock; não foi necessário alterar `package.json` nem `package-lock.json`.

## Validações executadas

- `npm install --package-lock-only --ignore-scripts --loglevel=error`: passou com código 0, informou a árvore atualizada e deixou `package-lock.json` byte-a-byte inalterado. Nenhum script foi executado.
- `npm audit --package-lock-only --json`: reproduziu os quatro lows e confirmou ausência de moderate/high/critical.
- `python3 -m json.tool package.json` e `python3 -m json.tool package-lock.json`: ambos passaram.
- `npm pkg get scripts`: confirmou 21 scripts declarados, incluindo `test`, `test:stress`, `test:performance-gates`, `lint`, `build`, `cloudflare:check` e os comandos de bundle. Os scripts não foram executados nesta frente.
- `git diff --check -- package.json package-lock.json`: passou; não há diff nesses dois arquivos.

## Decisão e bloqueio residual

Não houve correção segura a aplicar nos arquivos de dependência. O patch de `follow-redirects` já está correto em `1.16.2`; o advisory restante de `deepmerge` é low, alcançável pela cadeia de email de produção e não possui versão corrigida upstream. Portanto, o estado não deve ser descrito como “npm audit limpo”. A aprovação de release deve tratar esse low sem fix como risco conhecido ou aguardar uma correção upstream; o próximo passo de integração pode rodar `npm ci` após a barreira combinada, mas isso não elimina o achado.

## Referências

[1]: https://github.com/advisories/GHSA-mrwp-f3q8-3g9p "follow-redirects: Cross-realm sensitiveHeaders arrays are discarded and custom credentials can follow redirects"
[2]: https://www.npmjs.com/package/follow-redirects?activeTab=versions "follow-redirects no npm — versão publicada"
[3]: https://github.com/advisories/GHSA-gcqx-w48m-w2h4 "deepmerge mergeObject() allows prototype poisoning of returned objects"
